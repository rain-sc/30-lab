# 10 開獎：排程與狀態機

## 1. 要解決什麼問題

每 5 分鐘要發生這些事，**不管有沒有人開著網頁**：

| 時間（以 03:25 開始的一期為例） | 要做的事 |
|---|---|
| 03:25:00 | 建立新的一期，開放下注 |
| 03:29:45 | 停止下注（開獎前 15 秒） |
| 03:30:00 | 開出 6 個號碼 + 1 個特別號碼；同時下一期開放 |
| 03:30:01 左右 | 結算派彩（第 11 章） |

前端用 `setInterval`；NestJS 用 `@nestjs/schedule` 的 `@Interval`；Spring 用 **`@Scheduled`**。

## 2. 期數的狀態機

```
       開獎前 15 秒      開獎時間          結算完成
OPEN ─────────────▶ CLOSED ─────────▶ DRAWN ─────────▶ SETTLED
可以下注              不能下注            有號碼了           有彩池、獎級統計
```

每一期只會往右走，不會倒退。**每一次轉換都是一個條件更新**：「只有目前是 OPEN 的，才能改成 CLOSED」。

## 3. 排程的設定

```java
// config/SchedulingConfig.java
@Configuration
@EnableScheduling                                         // 開啟 @Scheduled
@ConditionalOnProperty(prefix = "app.scheduling", name = "enabled", havingValue = "true", matchIfMissing = true)
public class SchedulingConfig {

    @Bean
    public ThreadPoolTaskScheduler taskScheduler() {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(2);                         // 2 條執行緒
        scheduler.setThreadNamePrefix("scheduler-");
        return scheduler;
    }
}
```

- 測試時 `app.scheduling.enabled=false`，這個 class 不會被建立，排程不會跑（第 3 章）
- **為什麼要 2 條執行緒？** Spring 預設只有 1 條，所有排程排隊執行。開獎（`DrawTicker`）和結算（`SettlementTicker`）各用一條，結算跑比較久時不會卡住開獎

**執行緒**：Node 只有一條主執行緒，靠事件迴圈處理所有事；Java 可以同時跑很多條。HTTP 請求由 Tomcat 的執行緒池處理（預設最多 200 條），排程由上面這 2 條處理，**彼此同時進行**。這也是第 3 章說「Service 不能存請求的資料在欄位裡」的原因。

## 4. `DrawTicker`：每秒執行一次

```java
// draw/scheduler/DrawTicker.java
@Slf4j
@Component
@RequiredArgsConstructor
public class DrawTicker {
    private static final String TOPIC = "/topic/draws";

    private final DrawService drawService;
    private final SimpMessagingTemplate messagingTemplate;

    @Scheduled(fixedDelay = 1000)                         // 上一次跑完之後，等 1 秒再跑
    public void tick() {
        Instant now = Instant.now().truncatedTo(ChronoUnit.MILLIS);
        DrawService.TickResult result = drawService.tick(now);

        if (result.opened() != null) {
            publish(DrawEvent.Type.OPENED, result.opened(), now);
        }
        result.closed().forEach(d -> publish(DrawEvent.Type.CLOSED, d, now));
        result.drawn().forEach(d -> publish(DrawEvent.Type.DRAWN, d, now));
    }

    private void publish(DrawEvent.Type type, Draw draw, Instant now) {
        log.info("{} {}", type, draw.getDrawNo());         // 日誌：OPENED 20261023-0042
        messagingTemplate.convertAndSend(TOPIC, new DrawEvent(type, now, DrawResponse.from(draw)));   // WebSocket 推播
    }
}
```

| `@Scheduled` 寫法 | 意思 |
|---|---|
| `fixedDelay = 1000` | 上一次**跑完**後等 1 秒。跑了 3 秒，下一次就是 4 秒後，不會重疊 |
| `fixedRate = 1000` | 以**開始時間**計算，每 1 秒開始一次。上一次超過 1 秒還沒跑完，下一次會在它結束後**馬上**接著跑（同一個方法不會同時跑兩份） |
| `cron = "0 0 * * * *"` | 每小時整點 |

**Ticker 只負責「叫 Service 做事」和「推播」**，規則都在 `DrawService`。跟 Controller 只處理 HTTP 是同一個道理。

## 5. 「對帳」思維：每秒檢查，而不是定時觸發

直覺的寫法是「03:29:45 執行截止、03:30:00 執行開獎」。這個專案**不這樣做**，而是：

> **每秒問一次：現在這個時間，應該是什麼狀態？有沒有該做但還沒做的事？**

```java
// draw/service/DrawService.java
public TickResult tick(Instant now) {
    Draw opened = openCurrent(now);       // 現在這期建立了沒？沒有就建
    List<Draw> closed = closeDue(now);    // 有沒有過了截止時間還是 OPEN 的？有就改成 CLOSED
    List<Draw> drawn = drawDue(now);      // 有沒有過了開獎時間還是 CLOSED 的？有就開獎
    return new TickResult(opened, closed, drawn);
}
```

好處：**後端停機 10 分鐘再啟動，會自動補做所有錯過的事**。

```
03:24 後端停機（0041 期還是 OPEN）
03:36 後端啟動，第一次 tick：
  openCurrent → 建立 0044（現在這期）
  closeDue   → 0041 截止了 → CLOSED
  drawDue    → 0041 該開獎了 → DRAWN
接著 SettlementTicker 結算 0041
（0042、0043 停機時根本沒建立，就直接跳過，沒人能在那段時間下注）
```

≈ React 的思維：不是「按鈕按下時改畫面」，而是「畫面 = f(state)」，每次都從目前的狀態推出應該長怎樣。

## 6. `DrawSchedule`：用時間算出期數

**不需要查資料庫，給一個時間點就能算出是哪一期**：

```java
// draw/service/DrawSchedule.java
@Component
public class DrawSchedule {
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("yyyyMMdd").withZone(ZoneOffset.UTC);
    private static final long DAY_MILLIS = Duration.ofDays(1).toMillis();

    private final Duration interval;     // 5 分鐘
    private final Duration cutoff;       // 15 秒

    public DrawSchedule(GameProperties props) {
        this.interval = props.drawInterval();
        this.cutoff = props.bettingCutoff();
    }

    public DrawSlot slotAt(Instant time) {
        long intervalMillis = interval.toMillis();
        long openMillis = Math.floorDiv(time.toEpochMilli(), intervalMillis) * intervalMillis;   // ① 往下取整到 5 分鐘

        Instant openAt = Instant.ofEpochMilli(openMillis);
        Instant drawAt = openAt.plus(interval);      // ② 開放 + 5 分鐘 = 開獎
        Instant closeAt = drawAt.minus(cutoff);      // ③ 開獎 - 15 秒 = 截止

        return new DrawSlot(drawNo(openAt), openAt, closeAt, drawAt);
    }

    private String drawNo(Instant openAt) {
        long millisSinceMidnight = openAt.toEpochMilli() % DAY_MILLIS;     // ④ 這天過了幾毫秒
        long index = millisSinceMidnight / interval.toMillis() + 1;        //    第幾個 5 分鐘（從 1 開始）
        return DATE.format(openAt) + "-" + String.format("%04d", index);  //    "20261023-0042"
    }
}
```

### 用實際的時間算一次

現在是 `2026-10-23T03:27:30Z`：

| 步驟 | 計算 | 結果 |
|---|---|---|
| ① | 03:27:30 往下取整到 5 分鐘 | `openAt` = 03:25:00 |
| ② | 03:25:00 + 5 分鐘 | `drawAt` = 03:30:00 |
| ③ | 03:30:00 − 15 秒 | `closeAt` = 03:29:45 |
| ④ | 03:25 是當天的第 3×60+25 = 205 分鐘，205 ÷ 5 = 41，+1 | 第 42 期 → `20261023-0042` |

- 一天有 24 × 60 ÷ 5 = **288 期**，期號從 `0001` 到 `0288`
- `floorDiv`：往負無限大取整的除法。對正數跟一般的 `/` 一樣
- 期號、日期**一律用 UTC**。台灣時間早上 8 點是新的一天的第 1 期

**測試很好寫**，因為只是數學，不用資料庫（`DrawScheduleTest`）：

```java
DrawSlot slot = schedule.slotAt(Instant.parse("2026-10-16T00:04:59.999Z"));
assertThat(slot.drawNo()).isEqualTo("20261016-0001");    // 最後一毫秒還是第 1 期
```

## 7. `DrawService.tick` 的三個步驟

### 建立目前這期

```java
private Draw openCurrent(Instant now) {
    DrawSlot slot = drawSchedule.slotAt(now);
    if (drawRepository.findByDrawNo(slot.drawNo()).isPresent()) {
        return null;                                     // 已經建立了，什麼都不做（每秒都會走到這裡）
    }

    Draw draw = new Draw();
    draw.setDrawNo(slot.drawNo());
    draw.setStatus(DrawStatus.OPEN);
    draw.setOpenAt(slot.openAt());
    draw.setCloseAt(slot.closeAt());
    draw.setDrawAt(slot.drawAt());
    try {
        return drawRepository.save(draw);                // 回傳新建的期數 → DrawTicker 推播 OPENED
    } catch (DuplicateKeyException e) {
        return null;                                     // 別台伺服器剛好同時建好了（drawNo 唯一索引）
    }
}
```

### 截止所有該截止的

```java
private List<Draw> closeDue(Instant now) {
    Query query = Query.query(Criteria.where("status").is(DrawStatus.OPEN).and("closeAt").lte(now));
    Update update = new Update()
            .set("status", DrawStatus.CLOSED)
            .set("updatedAt", now);

    List<Draw> closed = new ArrayList<>();
    while (true) {
        Draw draw = mongoTemplate.findAndModify(query, update, FindAndModifyOptions.options().returnNew(true), Draw.class);
        if (draw == null) {
            return closed;                               // 沒有符合條件的了
        }
        closed.add(draw);                                // 改好一期，再找下一期
    }
}
```

- 條件「`status = OPEN` 且 `closeAt <= now`」：**只會改到還沒截止、而且時間到了的**
- 用 `while` 迴圈一次處理一期，直到找不到為止。通常只有 0 或 1 期；停機很久再啟動時可能好幾期
- 條件更新保證每一期只會被截止**一次**：就算兩台伺服器同時跑，第二台也找不到 `OPEN` 的了

### 開獎

```java
private List<Draw> drawDue(Instant now) {
    Query query = Query.query(Criteria.where("status").is(DrawStatus.CLOSED).and("drawAt").lte(now))
            .with(Sort.by("drawAt"));                    // 依時間順序，先開舊的

    List<Draw> drawn = new ArrayList<>();
    while (true) {
        DrawnNumbers result = numberGenerator.draw();    // 產生號碼
        Update update = new Update()
                .set("status", DrawStatus.DRAWN)
                .set("numbers", result.numbers())
                .set("specialNumber", result.specialNumber())
                .set("drawnAt", now)
                .set("updatedAt", now);
        Draw draw = mongoTemplate.findAndModify(query, update, FindAndModifyOptions.options().returnNew(true), Draw.class);
        if (draw == null) {
            return drawn;
        }
        drawn.add(draw);
    }
}
```

**號碼跟狀態在同一個條件更新裡寫入**。不可能出現「狀態是 DRAWN 但沒有號碼」，也不可能同一期被開兩次、出現兩組號碼。

- `drawAt`：排定的開獎時間（03:30:00）
- `drawnAt`：實際開出號碼的時間。停機後補開時會比 `drawAt` 晚

## 8. `NumberGenerator`：產生號碼

```java
// draw/service/NumberGenerator.java
@Component
@RequiredArgsConstructor
public class NumberGenerator {

    private final GameProperties gameProperties;
    private final SecureRandom random = new SecureRandom();

    public DrawnNumbers draw() {
        int maxNumber = gameProperties.maxNumber();          // 30
        List<Integer> pool = new ArrayList<>(maxNumber);
        for (int n = 1; n <= maxNumber; n++) {
            pool.add(n);                                     // [1, 2, ..., 30]
        }
        Collections.shuffle(pool, random);                   // 洗牌
        return new DrawnNumbers(List.copyOf(pool.subList(0, 6)), pool.get(6));   // 前 6 個是正碼，第 7 個是特別號碼
    }
}
```

- **洗牌後取前 7 個** = 真實攪珠機「不放回地抽 7 顆球」，7 個號碼一定不重複
- **`SecureRandom`** 而不是 `Random`：`Random` 的結果可以被預測（知道幾個輸出就能推出之後的），`SecureRandom` 是密碼學等級的亂數。≈ `crypto.getRandomValues()` vs `Math.random()`
- `List.copyOf(...)`：建立一個**不能修改**的複本

## 9. 推播：讓前端即時知道

每次狀態改變，`DrawTicker` 推一則訊息到 `/topic/draws`：

```json
{ "type": "DRAWN", "serverTime": "2026-10-23T03:30:00.123Z",
  "draw": { "drawNo": "20261023-0042", "status": "DRAWN", "numbers": [29, 9, 17, 19, 5, 6], "specialNumber": 27, ... } }
```

前端收到 `DRAWN` 就播開獎動畫。WebSocket 的細節在第 13 章。

## 10. 多台伺服器同時跑也安全

| 步驟 | 為什麼不會重複 |
|---|---|
| 建立期數 | `drawNo` 唯一索引，第二台會撞到 `DuplicateKeyException` |
| 截止、開獎 | 條件更新，第二台找不到符合條件的期數 |

所以不需要「分散式鎖」（例如 ShedLock）來保證只有一台在跑排程。

---

## 小練習

1. 看後端的 console，找到 `OPENED`、`CLOSED`、`DRAWN` 的日誌，間隔是不是 4 分 45 秒和 15 秒？
2. 用上面的方法手算：`2026-10-23T00:00:00Z` 是哪一期？`23:57:30Z` 呢？（第二個的 `drawAt` 是隔天的 00:00）
3. 停掉後端 6 分鐘以上再啟動，看日誌：哪幾期被補做了？哪一期被跳過了？
4. 為什麼 `drawDue` 要 `.with(Sort.by("drawAt"))`？如果不排序，停機很久補開獎時會有什麼問題？（提示：第 11 章的彩池要用上一期的滾存）
5. 如果把 `fixedDelay` 改成 `fixedRate`，而某一次 tick 因為資料庫慢花了 3 秒，會發生什麼？

上一章：[09 下注](09-betting-transactions.md)　下一章：[11 結算派彩](11-settlement.md)
