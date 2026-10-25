# 11 結算派彩：可以重跑的流程

## 1. 要解決什麼問題

開獎後，要把這期所有注單判獎、派彩。一期可能有上百張注單、上千注。

**最可怕的情況**：派彩派到一半，伺服器當機了。重啟之後：

- 已經派過的人，**不能再派一次**（不然積分變兩倍）
- 還沒派的人，**一定要補派**（不然玩家的獎金不見了）

最直覺的想法是「整個結算包成一個大交易」，但：

- MongoDB 的交易有時間限制（預設 60 秒）和大小限制，一期的注單太多就會失敗
- 大交易會長時間鎖住很多文件，這段時間玩家的錢包都不能動

**這個專案的做法**：把結算拆成幾個小步驟，**每一步都可以安全地重跑**。當機後重跑整個結算，做過的步驟會自動跳過。

## 2. 結算的步驟

```
找最早一期 DRAWN 的期數
 │
 ├─ ① 讀這期所有注單，算出投注總額、彩池、頭獎幾注
 │
 ├─ ② 判獎：每張 PENDING 的注單 → 條件更新成 WON / LOST
 │       （已經判過的不是 PENDING，自動跳過）
 │
 ├─ ③ 派彩：每張 WON 的注單 → 加積分 + 寫 PAYOUT 流水
 │       （撞到 PAYOUT + 注單 id 唯一索引 = 上次已經派過，跳過）
 │     → 條件更新 WON → PAID
 │
 └─ ④ 最後才把期數 DRAWN → SETTLED（寫入彩池、獎級統計）
```

**期數是最後才改成 SETTLED**。中途任何一步當機，期數都還是 `DRAWN`，下一秒 `SettlementTicker` 會再找到它、從頭跑一次。

## 3. `SettlementTicker`

```java
// settlement/scheduler/SettlementTicker.java
@Scheduled(fixedDelay = 1000)
public void tick() {
    Instant now = Instant.now().truncatedTo(ChronoUnit.MILLIS);
    while (true) {
        Optional<Draw> settled = settlementService.settleNext(now);   // 結算最早的一期 DRAWN
        if (settled.isEmpty()) {
            return;                                                   // 沒有要結算的了
        }
        Draw draw = settled.get();
        log.info("SETTLED {} pool={} jackpotWinners={} rollover={}", ...);
        messagingTemplate.convertAndSend(TOPIC, new DrawEvent(DrawEvent.Type.SETTLED, now, DrawResponse.from(draw)));
    }
}
```

```java
// settlement/service/SettlementService.java
public Optional<Draw> settleNext(Instant now) {
    return drawService.nextToSettle().map(draw -> settle(draw, now));
}

// draw/service/DrawService.java
public Optional<Draw> nextToSettle() {
    return drawRepository.findFirstByStatusOrderByDrawAtAsc(DrawStatus.DRAWN);   // 最早的一期 DRAWN
}
```

**一定要照時間順序**：這期的彩池 = 上期的滾存 + 這期的投注額 × 20%。如果先結算 0043 再結算 0042，0043 會拿到錯的滾存。

## 4. `settle`：逐段看

```java
// settlement/service/SettlementService.java
private Draw settle(Draw draw, Instant now) {
    List<Ticket> tickets = bettingService.ticketsOfDraw(draw.getDrawNo());

    // ① 彩池
    long turnover = turnover(tickets);                                                  // 投注總額
    long pool = prizeCalculator.jackpotPool(drawService.previousRollover(draw.getDrawAt()), turnover);

    int jackpotLines = (int) tickets.stream()                                           // 這期中頭獎的注數
            .flatMap(ticket -> ticket.getLines().stream())
            .filter(line -> isJackpot(line, draw))
            .count();
    long share = jackpotLines == 0 ? 0 : pool / jackpotLines;                          // 每注分到多少
    long rollover = jackpotLines == 0 ? pool : pool % jackpotLines;                    // 滾到下期的

    // ② 判獎
    for (Ticket ticket : tickets) {
        if (ticket.getStatus() != TicketStatus.PENDING) {
            continue;                                                                   // 已經判過了
        }
        List<LineResult> results = ticket.getLines().stream()
                .map(line -> prizeCalculator.judge(line, draw.getNumbers(), draw.getSpecialNumber(), share))
                .toList();
        long payout = results.stream().mapToLong(LineResult::prize).sum();
        bettingService.recordResult(ticket.getId(), results, payout, now);              // PENDING → WON / LOST
    }

    // ③ 派彩
    for (Ticket ticket : bettingService.wonTicketsOfDraw(draw.getDrawNo())) {          // 重新查 WON 的
        try {
            walletService.credit(ticket.getUserId(), ticket.getPayout(), WalletTransactionType.PAYOUT, ticket.getId());
        } catch (DuplicateKeyException e) {
            // 上次已經派過（結算到一半中斷後重跑），直接標成已派彩
        }
        bettingService.markPaid(ticket.getId(), now);                                   // WON → PAID
    }

    // ④ 期數完成
    PrizeSummary prizeSummary = summarize(draw, tickets, share);
    return drawService.markSettled(draw.getDrawNo(), pool, jackpotLines, rollover, prizeSummary, now);   // DRAWN → SETTLED
}
```

### ① 彩池怎麼算

```java
// settlement/service/PrizeCalculator.java
public long jackpotPool(long previousRollover, long turnover) {
    long contribution = turnover * prizeProperties.jackpotRatePercent() / 100;     // 投注額 × 20%
    return Math.max(prizeProperties.jackpotFloor(), previousRollover + contribution);   // 至少保底 500,000
}
```

```java
// draw/service/DrawService.java：上一期（已結算）滾下來多少
public long previousRollover(Instant drawAt) {
    return drawRepository.findFirstByStatusAndDrawAtBeforeOrderByDrawAtDesc(DrawStatus.SETTLED, drawAt)
            .map(Draw::getJackpotRollover)
            .orElse(0L);                                  // 第一期：沒有上一期
}
```

**算一次看看**（正式環境的設定：保底 500,000、注入 20%）：

| 情況 | 上期滾存 | 這期投注 | 注入 | 彩池 | 頭獎注數 | 每注分到 | 滾到下期 |
|---|---|---|---|---|---|---|---|
| 沒人中 | 510,000 | 1,000 | 200 | **510,200** | 0 | 0 | 510,200（整筆） |
| 兩注平分 | 510,200 | 1,500 | 300 | **510,500** | 2 | 255,250 | 0 |
| 三注平分 | 0 | 2,000 | 400 | 400 → 保底 **500,000** | 3 | 166,666 | 2（除不盡的零頭） |

- 沒人中：彩池整筆滾到下期，**一直累積**
- 有人中：平分，除不盡的零頭（`%`）滾到下期。下一期因為滾存很少，會回到保底
- 保底不足的部分由系統出（虛擬積分）

### ② 判獎：一注中了什麼

```java
// settlement/service/PrizeCalculator.java
public LineResult judge(List<Integer> line, List<Integer> numbers, int specialNumber, long jackpotShare) {
    int matched = (int) line.stream().filter(numbers::contains).count();    // 中了幾個正碼
    boolean specialHit = line.contains(specialNumber);                       // 有沒有中特別號碼
    PrizeTier tier = PrizeTier.of(matched, specialHit);                      // 對照獎級表
    return new LineResult(matched, specialHit, tier, prizeOf(tier, jackpotShare));
}
```

例：開出 `[5, 6, 9, 17, 19, 29]`，特別號碼 `27`

| 這一注 | 中幾個 | 特別號碼 | 獎級 | 獎金 |
|---|---|---|---|---|
| `[5, 6, 9, 17, 19, 29]` | 6 | — | 頭獎 | 平分彩池 |
| `[5, 6, 9, 17, 19, 27]` | 5 | ✅ | 二獎 | 56,000 |
| `[5, 6, 9, 17, 1, 2]` | 4 | ❌ | 五獎 | 160 |
| `[5, 6, 9, 27, 1, 2]` | 3 | ✅ | 六獎 | 80 |
| `[5, 6, 1, 2, 3, 4]` | 2 | ❌ | 沒中 | 0 |

**一注只算最高的獎級**：中 5 個 + 特別號碼只算二獎，不會再加三獎。這由 `PrizeTier.of` 的 `switch` 保證。

`recordResult` 是條件更新（只改 `PENDING` 的），所以重跑時已經判過的注單不會被改到：

```java
// betting/service/BettingService.java
Query query = Query.query(Criteria.where("_id").is(ticketId).and("status").is(TicketStatus.PENDING));
Update update = new Update()
        .set("status", payout > 0 ? TicketStatus.WON : TicketStatus.LOST)
        .set("results", results)
        .set("payout", payout)
        .set("settledAt", now)
        .set("updatedAt", now);
mongoTemplate.updateFirst(query, update, Ticket.class);
```

### ③ 派彩：唯一索引防止重複

`walletService.credit(userId, payout, PAYOUT, 注單id)` 會在交易裡做兩件事：加餘額、寫一筆 `PAYOUT` 流水（`refId` = 注單 id）。

流水有 `type + refId` 的唯一索引（第 9 章），所以**同一張注單的 `PAYOUT` 只能寫一次**：

- 第一次：加餘額 + 寫流水 → 成功
- 重跑時：加餘額 → 寫流水撞到唯一索引 → `DuplicateKeyException` → **交易回滾，餘額也不會加** → `catch` 接住，當作已經派過

> 這裡就是第 3 章「`@Transactional` 要透過代理」的重要性：`credit` 是從 `SettlementService` 呼叫的（別的 Bean），所以有經過代理、有交易。如果交易沒開，餘額會先加上去、流水才失敗，就會重複派彩。

然後 `markPaid` 把注單從 `WON` 改成 `PAID`（條件更新）。

### ④ 最後才標記期數完成

```java
// draw/service/DrawService.java
public Draw markSettled(String drawNo, long poolAmount, int jackpotWinners, long jackpotRollover,
                        PrizeSummary prizeSummary, Instant now) {
    Query query = Query.query(Criteria.where("drawNo").is(drawNo).and("status").is(DrawStatus.DRAWN));
    Update update = new Update()
            .set("status", DrawStatus.SETTLED)
            .set("poolAmount", poolAmount)
            .set("jackpotWinners", jackpotWinners)
            .set("jackpotRollover", jackpotRollover)          // 下一期結算時用
            .set("prizeSummary", prizeSummary)                // 開獎紀錄頁顯示的獎級統計
            .set("settledAt", now)
            .set("updatedAt", now);
    return mongoTemplate.findAndModify(query, update, FindAndModifyOptions.options().returnNew(true), Draw.class);
}
```

## 5. 當機在任何地方，重跑的結果

| 當機的時間點 | 重跑時發生什麼 | 結果 |
|---|---|---|
| ② 判獎到一半 | 判過的不是 `PENDING`，跳過；沒判的繼續判 | ✅ |
| ③ 派彩到一半 | 派過的撞到唯一索引，跳過；沒派的繼續派 | ✅ 沒有重複派彩 |
| ③ `credit` 成功、`markPaid` 之前 | 注單還是 `WON`，再 `credit` 一次 → 撞索引 → 跳過 → `markPaid` | ✅ |
| ④ 之前 | 期數還是 `DRAWN`，整個重跑，前面都跳過 | ✅ |

**注意 ① 每次重跑都會重新算**，但結果一樣（同樣的注單、同樣的上期滾存），所以彩池不會變。

## 6. 讀多寫少的資料：寫入時算好

### 獎級統計 `prizeSummary`

開獎紀錄頁要顯示每期「幾人中獎、每個獎級幾注」。每次有人看都重算一遍很浪費，**結算時算一次存起來**：

```java
// settlement/service/SettlementService.java
private PrizeSummary summarize(Draw draw, List<Ticket> tickets, long jackpotShare) {
    Map<PrizeTier, Integer> lines = new EnumMap<>(PrizeTier.class);      // 每個獎級中了幾注
    Set<String> winners = new HashSet<>();                               // 中獎的人（Set 自動去重複）
    long totalPayout = 0;
    for (Ticket ticket : tickets) {
        for (List<Integer> line : ticket.getLines()) {
            LineResult result = prizeCalculator.judge(line, draw.getNumbers(), draw.getSpecialNumber(), jackpotShare);
            if (result.tier() != null) {
                lines.merge(result.tier(), 1, Integer::sum);             // ≈ lines[tier] = (lines[tier] ?? 0) + 1
                winners.add(ticket.getUserId());
                totalPayout += result.prize();
            }
        }
    }
    List<TierWinners> tiers = Arrays.stream(PrizeTier.values())          // 固定 7 筆，沒人中的是 0
            .map(tier -> new TierWinners(tier, lines.getOrDefault(tier, 0),
                    tier == PrizeTier.FIRST ? jackpotShare : prizeCalculator.fixedPrize(tier)))
            .toList();
    return new PrizeSummary(winners.size(), totalPayout, tiers);
}
```

### 補算舊資料：`ApplicationRunner`

`prizeSummary` 是後來才加的功能，之前結算的期數沒有。所以加了一個**啟動時執行一次**的補算：

```java
// settlement/scheduler/PrizeSummaryBackfill.java
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "app.scheduling", name = "enabled", havingValue = "true", matchIfMissing = true)
public class PrizeSummaryBackfill implements ApplicationRunner {     // ≈ NestJS 的 onApplicationBootstrap()

    private final SettlementService settlementService;

    @Override
    public void run(ApplicationArguments args) {
        int filled = settlementService.backfillPrizeSummaries();
        if (filled > 0) {
            log.info("補算獎級統計：{} 期", filled);
        }
    }
}
```

- 只補「`SETTLED` 但 `prizeSummary` 是 null」的期數，用條件更新寫入（已經有的不覆蓋）
- 所以**每次啟動都跑也沒關係**：補完之後就找不到要補的了
- ≈ 資料庫 migration，但不用額外的工具

## 7. 目前的彩池：`GET /api/jackpot`

```java
// settlement/service/SettlementService.java
public JackpotResponse currentJackpot(Instant now) {
    DrawSlot slot = drawService.slotAt(now);                              // 現在這期
    long turnover = turnover(bettingService.ticketsOfDraw(slot.drawNo()));   // 目前為止的投注額
    long amount = prizeCalculator.jackpotPool(drawService.previousRollover(slot.drawAt()), turnover);
    return new JackpotResponse(slot.drawNo(), amount);
}
```

**跟結算用同一個公式**（`PrizeCalculator.jackpotPool`），所以畫面上顯示的彩池跟最後結算的一定一致。別人下注，這個數字也會變大。

## 8. 模組的位置

結算需要「期數」（draw）+「注單」（betting）+「錢包」（wallet），所以它放在**這三個模組的上層**：

```
settlement ──→ draw、betting、wallet
```

`draw` 不知道注單的存在，`betting` 不知道怎麼派彩。如果反過來讓 `draw` 去呼叫 `betting`，而 `betting` 本來就呼叫 `draw`（下注要檢查期數），就變成循環依賴了（第 3 章）。

---

## 小練習

1. 在 mongosh 找一期 `SETTLED` 的期數，看它的 `poolAmount`、`jackpotRollover`、`prizeSummary`。再找下一期，確認下一期的 `poolAmount` = max(500,000, 這期 `jackpotRollover` + 下一期投注額 × 20%)。
2. 開出 `[1, 2, 3, 4, 5, 6]`、特別號碼 `7`，`[1, 2, 3, 7, 8, 9]` 是什麼獎？`[1, 2, 7, 8, 9, 10]` 呢？用 `PrizeCalculatorTest` 驗證你的答案。
3. 如果把 ④ `markSettled` 移到 ② 判獎之前，當機時會發生什麼？
4. 為什麼 ③ 是重新查 `wonTicketsOfDraw`，而不是用一開始讀到的 `tickets`？（提示：重跑時，一開始讀到的注單狀態是什麼？）
5. 這個專案踩過的坑：計算投注額時把 `Ticket::getCost` 打成 `Ticket::getPayout`，兩個都是 `long`，編譯器抓不到。這種錯誤要怎麼發現？（第 14 章）

上一章：[10 開獎](10-scheduling-draws.md)　下一章：[12 聚合管線](12-aggregation.md)
