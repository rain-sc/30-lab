# 09 下注：交易、並發、冪等

這是整個專案**最重要**的一章。跟錢有關的程式，「正常情況會動」只是基本，真正的難題是：

- 使用者**連按兩下**送出、網路斷線後**前端自動重送**
- 同一個人**同時**從兩個分頁下注
- 寫到一半**當機**

## 1. 下注要做的三件事

1. 建立一張注單（`tickets`）
2. 扣積分（`wallets`）
3. 寫一筆積分流水（`wallet_transactions`，type = `BET`）

**這三件事必須一起成功、或一起失敗**。如果注單建了但扣款失敗，就是免費下注；扣了款但注單沒建，玩家的錢就不見了。

## 2. 交易（Transaction）

交易 ≈ SQL 的 `BEGIN ... COMMIT / ROLLBACK`：交易裡的寫入，**要嘛全部生效，要嘛全部取消**。

```sql
BEGIN;
  INSERT INTO tickets ...;
  UPDATE wallets SET balance = balance - 20 WHERE user_id = ? AND balance >= 20;   -- 0 rows → ROLLBACK
  INSERT INTO wallet_transactions ...;
COMMIT;
```

> MongoDB 的多文件交易**需要副本集**。這就是為什麼 `docker-compose.yml` 用 `--replSet rs0` 啟動，連一台也要設成副本集。Atlas M0 本身就是副本集。

Spring 有兩種寫法：

| 寫法 | 範圍 | 專案例子 |
|---|---|---|
| `@Transactional` 加在方法上 | 整個方法 | `WalletService.debit`、`credit` |
| `TransactionTemplate.execute(...)` | 只有 lambda 裡面那一段 | `BettingService.tryPlace` |

`@Transactional` 要透過代理才有效（第 3 章），而且整個方法都在交易裡。`TransactionTemplate` 可以**只把真的需要的幾行**包起來，前面的檢查不用佔著交易。

## 3. `BettingService.place`：逐行看

```java
// betting/service/BettingService.java
private static final int MAX_ATTEMPTS = 3;

public PlaceBetResponse place(String userId, PlaceBetRequest req, Instant now) {
    for (int attempt = 1; ; attempt++) {                         // ① 最多試 3 次
        try {
            return tryPlace(userId, req, now);
        } catch (DataIntegrityViolationException e) {            // ② 交易衝突
            if (attempt == MAX_ATTEMPTS) {
                throw e;
            }
            pause(attempt);                                      // ③ 等 50ms、100ms 再試
        }
    }
}

private PlaceBetResponse tryPlace(String userId, PlaceBetRequest req, Instant now) {
    // ④ 冪等：同一個 idempotencyKey 已經下過注了 → 直接回傳那張注單
    var existing = ticketRepository.findByUserIdAndIdempotencyKey(userId, req.idempotencyKey());
    if (existing.isPresent()) {
        return withBalance(existing.get(), userId);
    }

    // ⑤ 依玩法產生每一注，順便檢查上限（不需要在交易裡）
    Ticket ticket = new Ticket();
    ticket.setUserId(userId);
    ticket.setDrawNo(req.drawNo());
    ticket.setBetType(req.type());
    switch (req.type()) {
        case SINGLE -> {
            if (req.lines().size() > bettingProperties.maxLines()) {
                throw new BusinessException(ErrorCode.TOO_MANY_LINES);           // 40002
            }
            ticket.setLines(req.lines().stream().map(line -> line.stream().sorted().toList()).toList());   // 每注號碼排序
        }
        case MULTIPLE -> {
            if (req.numbers().size() > bettingProperties.maxMultipleNumbers()) {
                throw new BusinessException(ErrorCode.TOO_MANY_NUMBERS);         // 40003
            }
            ticket.setNumbers(req.numbers().stream().sorted().toList());
            ticket.setLines(LineExpander.multiple(req.numbers()));              // C(n, 6) 個組合
        }
        case BANKER -> {
            if (LineExpander.bankerLineCount(req.bankers().size(), req.legs().size()) > bettingProperties.maxBankerLines()) {
                throw new BusinessException(ErrorCode.TOO_MANY_LINES);           // 先算注數，太多就不展開
            }
            ticket.setBankers(req.bankers().stream().sorted().toList());
            ticket.setLegs(req.legs().stream().sorted().toList());
            ticket.setLines(LineExpander.banker(req.bankers(), req.legs()));    // 膽 + C(拖, 6 − 膽) 個組合
        }
    }
    ticket.setCost(ticket.getLines().size() * gameProperties.pointsPerBet());  // 注數 × 10
    ticket.setStatus(TicketStatus.PENDING);
    ticket.setIdempotencyKey(req.idempotencyKey());

    // ⑥ 檢查期數
    drawService.requireOpenForBetting(req.drawNo(), now);                // 不是目前這期、或已截止 → 40903
    walletService.getOrOpen(userId);

    // ⑦ 交易：建注單 + 扣款 + 寫流水
    Long balance = transactionTemplate.execute(status -> {
        Ticket saved = ticketRepository.insert(ticket);
        return walletService.debit(userId, saved.getCost(), WalletTransactionType.BET, saved.getId());
    });
    return new PlaceBetResponse(TicketResponse.from(ticket), balance);
}
```

### ⑤ 三種玩法，最後都變成 `lines`

複式、膽拖在這裡**展開成一注一注的 6 個號碼**，存進跟單式一樣的 `lines`。所以從 ⑦ 的扣款開始，到第 11 章的判獎、派彩、獎級統計，**完全不用知道是哪種玩法**。原始選號另外存在 `numbers` / `bankers` / `legs`，只是給前端顯示用。

```java
// betting/service/LineExpander.java
// 膽拖：每一注 = 全部的膽 + 從拖裡選 (6 - 膽數) 個，每一注由小到大
static List<List<Integer>> banker(List<Integer> bankers, List<Integer> legs) {
    List<Integer> sortedLegs = legs.stream().sorted().toList();
    List<List<Integer>> lines = new ArrayList<>();
    collect(sortedLegs, PICK_COUNT - bankers.size(), 0, new ArrayList<>(),
            combo -> lines.add(Stream.concat(bankers.stream(), combo.stream()).sorted().toList()));
    return lines;
}
```

`collect` 是遞迴找出「從 pool 選 k 個」的所有組合（≈ 前端寫過的排列組合題）。膽拖的注數上限是先用公式 C(拖, 6 − 膽) 算出來比較，**不先展開**：1 膽 29 拖有 118,755 注，真的展開會白白吃掉記憶體。

### ⑦ 交易裡發生了什麼

```java
// wallet/service/WalletService.java
@Transactional
public long debit(String userId, long amount, WalletTransactionType type, String refId) {
    Wallet wallet = mongoTemplate.findAndModify(
            Query.query(Criteria.where("userId").is(userId).and("balance").gte(amount)),   // 餘額夠才扣
            new Update().inc("balance", -amount).set("updatedAt", now()),
            FindAndModifyOptions.options().returnNew(true),
            Wallet.class);
    if (wallet == null) {
        throw new BusinessException(ErrorCode.INSUFFICIENT_POINTS);   // 40902
    }
    record(userId, type, -amount, wallet.getBalance(), refId);       // 流水：BET，-20，扣完的餘額，注單 id
    return wallet.getBalance();
}
```

`debit` 自己有 `@Transactional`，但它是在 `transactionTemplate.execute` **裡面**被呼叫的，Spring 會讓它**加入外面已經開好的交易**（預設的傳播行為 `REQUIRED`：有交易就加入，沒有才新開）。所以三個寫入都在同一個交易裡。

| 情況 | 結果 |
|---|---|
| 一切順利 | 三筆一起提交，回傳新餘額 |
| 餘額不夠：`debit` 丟 `BusinessException` | **交易回滾**，剛 `insert` 的注單也消失；回 `40902` |
| 撞到唯一索引、交易衝突 | 交易回滾，例外往外丟到 ② |

## 4. 冪等鍵：連按兩下、重送也只扣一次

### 問題

玩家按「確認下注」，請求送出去了，但回應還沒回來時網路斷了。前端不知道有沒有成功，再送一次 → **扣兩次錢**？

### 解法：每次「確認下注」產生一個 UUID

```ts
// 前端（概念）
const idempotencyKey = crypto.randomUUID()      // 按下確認時產生一次
await api.post('/api/tickets', { drawNo, idempotencyKey, lines })
// 失敗重試時，沿用同一個 idempotencyKey
```

後端兩道防線：

1. **④ 先查**：同一個人、同一個 key 已經有注單 → 不再扣款，**直接回傳那張注單和目前餘額**。前端收到的回應跟第一次成功時一樣
2. **唯一索引**：`tickets` 的 `userId + idempotencyKey` 是唯一的。兩個請求**同時**通過 ④（都還沒查到）時，第二個 `insert` 會撞到索引 → 交易回滾 → 進入重試 → 重試時 ④ 就查到第一張了

```java
@CompoundIndex(name = "userId_idempotencyKey", def = "{'userId': 1, 'idempotencyKey': 1}", unique = true)
```

**為什麼是 `userId + idempotencyKey`，不是只有 key？** 避免不同的人剛好用到同一個 key 互相干擾。

## 5. 並發：WriteConflict 與重試

### 什麼是 WriteConflict

兩個交易**同時改同一份文件**（例如同一個人在兩個分頁下注，都要改同一個錢包），MongoDB 會讓其中一個失敗（WriteConflict），而不是讓它們互相覆蓋。Spring 把它包成 `DataIntegrityViolationException`。

撞到唯一索引的 `DuplicateKeyException` 也是 `DataIntegrityViolationException` 的子類別，所以 ② 一次接住這兩種。

### 重試的流程

```
分頁 A、分頁 B 同時下注（不同的 key）

A: 交易開始 → insert 注單 A → 扣款（鎖住錢包）→ 提交 ✅
B: 交易開始 → insert 注單 B → 扣款 → ❌ WriteConflict（錢包正在被 A 改）→ 回滾
B: 等 50ms
B: 重試 → ④ 查 key（沒有）→ 交易 → insert → 扣款 → 提交 ✅
```

```
同一個請求被送了兩次（相同的 key）

1: 交易 → insert 注單 → 扣款 → 提交 ✅
2: 交易 → insert 注單 → ❌ 撞到 userId_idempotencyKey 唯一索引 → 回滾
2: 等 50ms
2: 重試 → ④ 查到第 1 次的注單 → 直接回傳，不扣款 ✅
```

> ⚠️ **重試前一定要「先查」**。如果重試時不先查冪等鍵，第二個請求會一直撞索引，3 次之後回 500。每日簽到就真的發生過這個問題（見第 7 節）。

## 6. 三種冪等手段

這個專案所有「不能做兩次」的事，都用下面三種方法之一：

| 手段 | 原理 | SQL 對照 | 專案例子 |
|---|---|---|---|
| **唯一索引** | 重複寫入會失敗 | `UNIQUE` 約束 | 下注 `userId + idempotencyKey`；流水 `type + refId` |
| **條件更新** | 只改「還在舊狀態」的資料 | `UPDATE ... WHERE status = '舊狀態'` | 注單 `PENDING → WON`、期數 `DRAWN → SETTLED` |
| **冪等鍵** | 前端產生 UUID，重送沿用 | — | 下注的 `idempotencyKey` |

### 流水的 `type + refId` 唯一索引

```java
// wallet/model/WalletTransaction.java
@CompoundIndex(name = "type_refId", def = "{'type': 1, 'refId': 1}", unique = true)
```

`refId` 是「這筆積分變動是因為什麼」：

| type | refId | 保證 |
|---|---|---|
| `SIGNUP_BONUS` | userId | 每個人只送一次註冊獎勵 |
| `DAILY_BONUS` | `userId:2026-10-23` | 每個人每天只能簽到一次 |
| `BET` | 注單 id | 每張注單只扣一次款 |
| `PAYOUT` | 注單 id | **每張注單只派一次彩**（第 11 章的關鍵） |

## 7. 每日簽到：重試前先查

```java
// wallet/service/DailyBonusService.java
public ClaimDailyBonusResponse claim(String userId, Instant now) {
    LocalDate today = today(now);
    for (int attempt = 1; ; attempt++) {
        try {
            return tryClaim(userId, today);
        } catch (DataIntegrityViolationException e) {
            // 同時送出時，交易之間會互相衝突（WriteConflict）；重試時先查到已經領過，就會回傳 40904
            if (attempt == MAX_ATTEMPTS) {
                throw e;
            }
            pause(attempt);
        }
    }
}

private ClaimDailyBonusResponse tryClaim(String userId, LocalDate today) {
    String refId = refId(userId, today);                        // "6adb...:2026-10-23"
    if (transactionRepository.existsByTypeAndRefId(WalletTransactionType.DAILY_BONUS, refId)) {
        throw new BusinessException(ErrorCode.DAILY_BONUS_CLAIMED);   // 先查：已經領過 → 40904
    }
    walletService.getOrOpen(userId);

    long amount = walletProperties.dailyBonus();
    try {
        long balance = walletService.credit(userId, amount, WalletTransactionType.DAILY_BONUS, refId);
        return new ClaimDailyBonusResponse(amount, balance, nextResetAt(today));
    } catch (DuplicateKeyException e) {                         // 跟別人同時寫，撞到唯一索引
        throw new BusinessException(ErrorCode.DAILY_BONUS_CLAIMED);
    }
}
```

**踩過的坑**：最早的版本沒有「先查」，5 個請求同時簽到時，交易互相衝突、一直重試失敗，最後回 500。加了「先查」之後，重試時馬上發現「已經領過」，回 `40904`。

### 「今天」是哪一天

```java
private static LocalDate today(Instant now) {
    return LocalDate.ofInstant(now, ZoneOffset.UTC);          // 用 UTC 的日期
}
```

用 UTC 而不是玩家的時區：全世界同一時間重置（台灣早上 8 點），改電腦時區也不能一天領兩次。

## 8. 檢查期數：時間算出來的

```java
// draw/service/DrawService.java
public void requireOpenForBetting(String drawNo, Instant now) {
    DrawSlot slot = drawSchedule.slotAt(now);                       // 現在這個時間點屬於哪一期
    if (!slot.drawNo().equals(drawNo) || !now.isBefore(slot.closeAt())) {
        throw new BusinessException(ErrorCode.BETTING_CLOSED);      // 不是目前這期，或已經過了截止時間
    }
}
```

**不查資料庫**，直接用時間算出目前是哪一期、幾點截止（第 10 章）。所以截止時間是精確的，就算排程晚了一秒才把期數改成 `CLOSED`，截止後送來的下注也會被擋下。

---

## 小練習

1. 用 Swagger 下注，`idempotencyKey` 填 `test-1`，送兩次。兩次回傳的注單 id 一樣嗎？餘額扣了幾次？
2. 在 mongosh 找到那張注單對應的 `BET` 流水：`db.wallet_transactions.find({ type: "BET", refId: "注單id" })`。
3. 用 PowerShell 同時送 5 次簽到，看看結果（應該 1 個成功、4 個 `40904`）：
   ```powershell
   1..5 | ForEach-Object -Parallel { curl.exe -s -X POST -b "tl_token=你的token" http://localhost:8088/api/wallet/daily-bonus } -ThrottleLimit 5
   ```
4. 如果拿掉 `tickets` 的 `userId_idempotencyKey` 唯一索引，只靠 ④ 的「先查」，在什麼情況下會重複扣款？
5. 為什麼 `requireOpenForBetting` 用時間計算，而不是查資料庫裡期數的 `status`？

上一章：[08 MongoDB](08-mongodb.md)　下一章：[10 開獎](10-scheduling-draws.md)
