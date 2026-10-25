# 14 測試

## 1. 為什麼要寫測試

這個專案的測試真的抓到過這些 bug：

| bug | 怎麼被抓到的 |
|---|---|
| 計算投注額時把 `Ticket::getCost` 打成 `Ticket::getPayout`（兩個都是 `long`，編譯器不會報錯） | 「彩池應該是 1,500,010」的測試失敗 |
| 改獎金時刪掉了 `jackpot-rate-percent` 那一行，彩池永遠不會增加 | 4 個結算測試失敗 |
| 同時簽到 5 次，WriteConflict 重試失敗，回 500 | 並發測試失敗 |

**跟錢有關的邏輯，人工測試很難測到「同時」「當機後重跑」這種情況**，只能靠自動化測試。

## 2. 工具對照

| 用途 | Java | Jest 對照 |
|---|---|---|
| 測試框架 | **JUnit 5** | `jest` |
| 標記一個測試 | `@Test void name() { ... }` | `test('name', () => { ... })` |
| 每個測試前執行 | `@BeforeEach` | `beforeEach` |
| 同一個測試、不同資料 | `@ParameterizedTest` + `@CsvSource` | `test.each` |
| 重複執行 | `@RepeatedTest(1000)` | 自己寫迴圈 |
| 斷言 | **AssertJ** `assertThat(x).isEqualTo(y)` | `expect(x).toBe(y)` |
| 啟動整個 Spring | `@SpringBootTest` | `Test.createTestingModule(...)` |

測試檔案放在 `src/test/java/`，**package 跟被測的 class 一樣**（所以能測 package-private 的方法）。檔名慣例是 `XxxTest`（單元測試）或 `XxxIntegrationTest`（整合測試）。

## 3. 單元測試：不需要 Spring、不需要資料庫

**只測一個 class 的邏輯**，依賴自己 `new` 出來。跑起來是毫秒級。

```java
// src/test/java/com/thirtylab/settlement/service/PrizeCalculatorTest.java
class PrizeCalculatorTest {

    private static final List<Integer> NUMBERS = List.of(1, 2, 3, 4, 5, 6);   // 開出的號碼
    private static final int SPECIAL = 7;                                      // 特別號碼

    private final PrizeCalculator calculator = new PrizeCalculator(            // 直接 new，自己給設定
            new PrizeProperties(1_000_000, 20, 500_000, 50_000, 9_600, 640, 320, 40));

    @ParameterizedTest
    @CsvSource({
            "1 2 3 4 5 6,     6, false, FIRST,   123456",
            "1 2 3 4 5 7,     5, true,  SECOND,  500000",
            "1 2 3 4 5 8,     5, false, THIRD,   50000",
            "1 2 3 4 7 8,     4, true,  FOURTH,  9600",
            "1 2 3 4 8 9,     4, false, FIFTH,   640",
            "1 2 3 7 8 9,     3, true,  SIXTH,   320",
            "1 2 3 8 9 10,    3, false, SEVENTH, 40",
            "1 2 7 8 9 10,    2, true,  ,        0",       // 空白 = null：沒中獎
            "10 11 12 13 14 15, 0, false, ,      0"
    })
    void judgesEachTier(String line, int matched, boolean specialHit, PrizeTier tier, long prize) {
        LineResult result = calculator.judge(parse(line), NUMBERS, SPECIAL, 123_456);

        assertThat(result).isEqualTo(new LineResult(matched, specialHit, tier, prize));
    }

    @Test
    void jackpotPoolNeverBelowFloor() {
        assertThat(calculator.jackpotPool(0, 100)).isEqualTo(1_000_000);
    }

    @Test
    void jackpotPoolAddsRolloverAndContribution() {
        assertThat(calculator.jackpotPool(1_500_000, 1_000)).isEqualTo(1_500_200);
    }
}
```

逐段看：

- **`@CsvSource`**：每一行是一組測試資料，逗號分隔，依序對應方法的參數。字串 `"FIRST"` 會自動轉成 `PrizeTier.FIRST`；空白會變成 `null`。這 9 行會跑成 9 個測試
- **`assertThat(result).isEqualTo(new LineResult(...))`**：`LineResult` 是 record，`equals` 會比較所有欄位，所以**一行就檢查完 4 個欄位**
- **`123_456`**：故意給一個奇怪的頭獎金額，確認頭獎真的拿到傳進去的那個值，而不是別的

≈ Jest：

```ts
test.each([
  ['1 2 3 4 5 6', 6, false, 'FIRST', 123456],
  ...
])('judges %s', (line, matched, specialHit, tier, prize) => {
  expect(calculator.judge(parse(line), NUMBERS, SPECIAL, 123456)).toEqual({ matched, specialHit, tier, prize })
})
```

### 其他單元測試

| 測試 | 測什麼 | 技巧 |
|---|---|---|
| `DrawScheduleTest` | 期號、截止時間的計算 | 邊界：`00:04:59.999` 還是第 1 期、`00:05:00` 是第 2 期 |
| `NumberGeneratorTest` | 7 個號碼不重複、都在 1~30 | `@RepeatedTest(1000)`：亂數的東西多跑幾次 |
| `GameRulesServiceTest` | 中獎組合數 | 30 球和 49 球各算一次 |
| `BallNumberValidatorTest` | 號碼範圍驗證 | 邊界值 0、1、30、31 |

## 4. 整合測試：真的 Spring + 真的 MongoDB

**測多個 class 合作的結果**，連資料庫一起測。跑起來是秒級（要啟動 Spring）。

```java
// src/test/java/com/thirtylab/settlement/service/SettlementServiceIntegrationTest.java
@SpringBootTest                       // ① 啟動整個 Spring
@ActiveProfiles("test")               // ② 用 application-test.properties
class SettlementServiceIntegrationTest {

    @Autowired private SettlementService settlementService;   // ③ 從 Spring 拿真的 Bean
    @Autowired private TicketRepository ticketRepository;
    @Autowired private MongoTemplate mongoTemplate;
    ...

    @BeforeEach
    void clean() {                    // ④ 每個測試前清空資料
        mongoTemplate.remove(new Query(), Ticket.class);
        mongoTemplate.remove(new Query(), Draw.class);
        mongoTemplate.remove(new Query(), Wallet.class);
        mongoTemplate.remove(new Query(), WalletTransaction.class);
    }

    @Test
    void noJackpotWinnerRollsTheWholePoolOver() {
        // 準備：上一期已結算、滾存 1,500,000；這期有 5 注都沒中
        saveDraw("20261020-0036", Instant.parse("2026-10-20T03:00:00Z"), DrawStatus.SETTLED, 1_500_000L);
        String ticketId = bet("u2", NO_WIN, NO_WIN, NO_WIN, NO_WIN, NO_WIN);
        saveDraw(DRAW_NO, DRAW_AT, DrawStatus.DRAWN, null);

        // 執行：結算
        Draw settled = settlementService.settleNext(SETTLE_TIME).orElseThrow();

        // 檢查
        assertThat(settled.getPoolAmount()).isEqualTo(1_500_010);              // 1,500,000 + 50 × 20%
        assertThat(settled.getJackpotWinners()).isZero();
        assertThat(settled.getJackpotRollover()).isEqualTo(1_500_010);         // 整筆滾到下期
        assertThat(ticketRepository.findById(ticketId).orElseThrow().getStatus()).isEqualTo(TicketStatus.LOST);
        assertThat(walletService.balance("u2").balance()).isEqualTo(9_950);    // 10,000 - 50
    }
}
```

| 編號 | 說明 |
|---|---|
| ① | 跟正式啟動一樣建立所有 Bean。同一次 `mvnw test` 裡，設定相同的測試類別會**共用同一個 Spring**（不會每個類別都重新啟動） |
| ② | **一定要加**。沒加就會連到正式資料庫 `thirtylab`（這個專案真的發生過） |
| ③ | 測試類別沒有建構子，所以用 `@Autowired` 欄位注入 |
| ④ | 每個測試都從乾淨的狀態開始，測試之間不會互相影響 |

**準備 → 執行 → 檢查**（Arrange → Act → Assert）：每個測試都照這個結構寫，讀的人一眼看出在測什麼。

### 把數字算死

`isEqualTo(1_500_010)` 而不是 `isGreaterThan(1_500_000)`。只有把確切的數字寫出來，才抓得到 `getCost` / `getPayout` 打錯這種 bug（投注 50 vs 派彩 0，彩池差 10）。

### 測「當機後重跑」

```java
@Test
void rerunAfterCrashDoesNotPayTwice() {
    String ticketId = bet("u5", List.of(1, 2, 3, 8, 9, 10));           // 中七獎（測試設定是 40）
    saveDraw(DRAW_NO, DRAW_AT, DrawStatus.DRAWN, null);
    settlementService.settleNext(SETTLE_TIME).orElseThrow();            // 第一次結算，完整跑完

    // 模擬「派彩之後、標記完成之前當機」：把注單改回 WON、期數改回 DRAWN
    Ticket ticket = ticketRepository.findById(ticketId).orElseThrow();
    ticket.setStatus(TicketStatus.WON);
    ticketRepository.save(ticket);
    Draw draw = drawRepository.findByDrawNo(DRAW_NO).orElseThrow();
    draw.setStatus(DrawStatus.DRAWN);
    drawRepository.save(draw);

    settlementService.settleNext(SETTLE_TIME).orElseThrow();            // 重跑

    assertThat(walletService.balance("u5").balance()).isEqualTo(10_000 - 10 + 40);   // 只派了一次
    assertThat(transactionRepository.findByUserId("u5"))
            .filteredOn(tx -> tx.getType() == WalletTransactionType.PAYOUT)
            .hasSize(1);                                                 // PAYOUT 流水只有一筆
    ...
}
```

**手動把資料改回「當機時的狀態」**，再跑一次，檢查沒有重複派彩。

### 測「同時」

```java
// src/test/java/com/thirtylab/betting/service/BettingServiceIntegrationTest.java
@Test
void concurrentResendsWithSameKeyChargeOnce() {
    ExecutorService pool = Executors.newFixedThreadPool(5);              // 5 條執行緒
    List<CompletableFuture<Object>> futures = IntStream.range(0, 5)
            .mapToObj(i -> CompletableFuture.supplyAsync(() -> {         // 同時送 5 次同一個 key 的下注
                try {
                    return (Object) bettingService.place("u3", request("k1", LINE), NOW);
                } catch (RuntimeException e) {
                    return e;
                }
            }, pool))
            .toList();
    List<Object> results = futures.stream().map(CompletableFuture::join).toList();   // 等全部完成
    pool.shutdown();

    assertThat(results).allMatch(r -> r instanceof PlaceBetResponse);      // 5 次都成功（沒有錯誤）
    assertThat(ticketRepository.findAll()).hasSize(1);                     // 但只有 1 張注單
    assertThat(walletService.balance("u3").balance()).isEqualTo(9_990);    // 只扣了 10
}
```

`CompletableFuture` ≈ `Promise`；`supplyAsync(..., pool)` ≈ 在另一條執行緒執行；`join()` ≈ `await`。整段 ≈ `await Promise.all([1,2,3,4,5].map(() => place(...)))`，但是**真的同時**在不同執行緒跑。

## 5. 設計測試資料

| 原則 | 例子 |
|---|---|
| **測邊界** | 時間：`23:59:59.999` vs `00:00:00`；號碼：0、1、30、31 |
| **測同分** | 排行榜：兩個人都是 320，名次都是 1，下一個是 3 |
| **超過上限** | 要測「最多 10 筆」，就放 12 筆，檢查只回 10 筆而且是最新的 |
| **要被排除的資料** | 排行榜測試放一筆 `BET`（不是中獎）、一筆上週的派彩，確認不會被算進去 |
| **固定時間** | `Instant.parse("2026-10-21T12:00:00Z")`，不要用 `Instant.now()`（每次跑結果不一樣） |
| **固定規則** | 測試設定固定用 49 球、舊獎金，跟正式環境的遊戲平衡分開（第 4 章） |

## 6. 怎麼跑測試

| 想做的事 | 方法 |
|---|---|
| 跑全部 | `cd backend; .\mvnw.cmd test` |
| 跑全部（先清掉舊的編譯結果） | `.\mvnw.cmd clean test`（改過 package 名稱、刪過檔案後要用這個） |
| 只跑一個類別 | `.\mvnw.cmd test -Dtest=PrizeCalculatorTest` |
| 只跑一個方法 | `.\mvnw.cmd test -Dtest=PrizeCalculatorTest#jackpotPoolNeverBelowFloor` |
| 在 IntelliJ 跑 | 點測試類別或方法旁邊的綠色三角形 ▶ |
| 在 IntelliJ 除錯測試 | 綠色三角形 → Debug，可以設中斷點 |

整合測試需要 Docker 的 MongoDB 和 Redis 在跑（`docker compose up -d`）。

### 看懂失敗訊息

```
[ERROR]   SettlementServiceIntegrationTest.noJackpotWinnerRollsTheWholePoolOver:116
expected: 1500010L
 but was: 1500000L
```

- `:116`：失敗在第 116 行
- `expected` 是你寫的預期值，`but was` 是實際值
- 差 10 → 剛好是 50 × 20%，代表「注入彩池」那段沒算到 → 去查 `jackpotRatePercent`

## 7. 還沒做的測試

| 種類 | 能抓到什麼 | 狀態 |
|---|---|---|
| **HTTP 層測試**（`MockMvc`） | Controller 漏寫、`SecurityConfig` 忘了加 `permitAll`、JSON 格式不對 | 還沒寫。目前靠手動打 API 檢查。這個專案漏過兩次 `permitAll`，就是因為 Service 測試不會經過 HTTP 和 Security |
| **Testcontainers** | 測試時自動啟動一個乾淨的 MongoDB 容器，不用先 `docker compose up` | 還沒做。之後放上 GitHub Actions 自動跑測試時需要 |

---

## 小練習

1. 在 IntelliJ 打開 `PrizeCalculatorTest`，點 `judgesEachTier` 旁邊的 ▶，看 9 個測試各自的名稱。
2. 故意把 `PrizeCalculator.jackpotPool` 的 `/ 100` 改成 `/ 10`，跑 `PrizeCalculatorTest`，看失敗訊息。改回來。
3. 在 `PrizeCalculatorTest` 加一行 `@CsvSource` 資料：中 4 個 + 特別號碼。預期是什麼獎、多少錢？（用測試的設定，不是正式環境的）
4. `NumberGeneratorTest` 為什麼要 `@RepeatedTest(1000)`，而不是只跑一次？
5. 想想看：要測「排行榜同分同名次」，你會準備什麼資料？（再去看 `LeaderboardServiceIntegrationTest.dailyBoardRanksTodaysPayoutsWithTies` 對答案）

上一章：[13 WebSocket](13-websocket.md)　下一章：[15 踩坑與面試](15-pitfalls-interview.md)
