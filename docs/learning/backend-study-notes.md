# 後端學習筆記：從 NestJS + PostgreSQL 到 Spring Boot + MongoDB

寫給「熟悉前端、寫過 NestJS + PostgreSQL」的自己。每一節都用這個專案（30 Lab）實際寫過的程式碼當例子，檔案路徑都是 `backend/src/main/java/com/thirtylab/` 底下。

配合 [project-workflow.md](project-workflow.md)（架構圖、流程圖、API 總表）一起看。

## 目錄

1. [概念對照表：NestJS ↔ Spring Boot](#1-概念對照表nestjs--spring-boot)
2. [Java 語法速查（給 TypeScript 工程師）](#2-java-語法速查給-typescript-工程師)
3. [Spring 核心：Bean、依賴注入、代理](#3-spring-核心bean依賴注入代理)
4. [設定：application.properties、@ConfigurationProperties、Profile](#4-設定applicationpropertiesconfigurationpropertiesprofile)
5. [Web 層：Controller、統一回應、錯誤處理、驗證](#5-web-層controller統一回應錯誤處理驗證)
6. [Spring Security + JWT Cookie + 單一 Session](#6-spring-security--jwt-cookie--單一-session)
7. [MongoDB vs PostgreSQL](#7-mongodb-vs-postgresql)
8. [Spring Data MongoDB：Repository 與 MongoTemplate](#8-spring-data-mongodbrepository-與-mongotemplate)
9. [索引設計與 explain](#9-索引設計與-explain)
10. [交易、並發與冪等](#10-交易並發與冪等)
11. [聚合管線（Aggregation Pipeline）](#11-聚合管線aggregation-pipeline)
12. [排程與「每秒對帳」](#12-排程與每秒對帳)
13. [WebSocket（STOMP）推播](#13-websocketstomp推播)
14. [模組化單體：模組邊界怎麼守](#14-模組化單體模組邊界怎麼守)
15. [測試](#15-測試)
16. [踩過的坑（真實發生過的）](#16-踩過的坑真實發生過的)
17. [面試可以講的設計點](#17-面試可以講的設計點)

---

## 1. 概念對照表：NestJS ↔ Spring Boot

| 概念 | NestJS | Spring Boot | 本專案例子 |
|---|---|---|---|
| 程式進入點 | `main.ts` + `NestFactory.create()` | `@SpringBootApplication` 的 `main()` | `ThirtyLabBackendApplication` |
| 模組 | `@Module({ providers, controllers })` | **沒有模組宣告**，用 package 分；`@ComponentScan` 自動掃描整個 package | `account/`、`wallet/`… |
| 可被注入的類別 | `@Injectable()` | `@Component` / `@Service` / `@Repository` / `@Configuration` | `@Service class WalletService` |
| 依賴注入 | constructor 參數 | constructor 參數（配 Lombok `@RequiredArgsConstructor` + `private final` 欄位） | 每個 Service |
| Controller | `@Controller('wallet')` | `@RestController` + `@RequestMapping("/api/wallet")` | `WalletController` |
| 路由 | `@Get(':id')` | `@GetMapping("/{id}")` | `@GetMapping("/api/draws/{drawNo}/winners")` |
| 路徑參數 | `@Param('id')` | `@PathVariable` | `DrawWinnersController` |
| Query | `@Query('page')` | `@RequestParam(defaultValue = "1")` | 分頁 |
| Body | `@Body() dto` | `@Valid @RequestBody dto` | `TicketController.place` |
| DTO 驗證 | `class-validator` + `ValidationPipe` | Jakarta Validation（`@NotBlank`、`@Size`…）+ `@Valid` | `PlaceBetRequest` |
| Enum 轉換 | `ParseEnumPipe` | 自動轉（字串 → enum），錯了丟 `MethodArgumentTypeMismatchException` | `LeaderboardPeriod` |
| 全域錯誤處理 | Exception Filter | `@RestControllerAdvice` + `@ExceptionHandler` | `GlobalExceptionHandler` |
| Guard / 驗證身分 | `AuthGuard` + Passport | Spring Security filter chain | `SecurityConfig`、`JwtCookieFilter` |
| 取得目前使用者 | 自訂 `@User()` decorator | `@AuthenticationPrincipal` | `@AuthenticationPrincipal String userId` |
| 設定 | `ConfigModule` + `.env` | `application.properties` + `@ConfigurationProperties` | `WalletProperties` |
| 環境區分 | `.env.test` | Profile：`application-test.properties` + `@ActiveProfiles("test")` | 測試 |
| ORM / Repository | TypeORM / Prisma | Spring Data（`MongoRepository`）+ `MongoTemplate` | `TicketRepository` |
| Migration | TypeORM migration | （本專案）啟動時 `ApplicationRunner` 補資料；正式可用 Mongock | `PrizeSummaryBackfill` |
| 排程 | `@nestjs/schedule` `@Interval` | `@EnableScheduling` + `@Scheduled(fixedDelay = 1000)` | `DrawTicker` |
| 啟動時執行一次 | `onApplicationBootstrap()` | `ApplicationRunner.run()` | `PrizeSummaryBackfill` |
| WebSocket | `@WebSocketGateway` + socket.io | STOMP（`@EnableWebSocketMessageBroker`）+ `SimpMessagingTemplate` | `WebSocketConfig` |
| 交易 | `dataSource.transaction(...)` | `@Transactional` / `TransactionTemplate` | `BettingService.tryPlace` |
| API 文件 | `@nestjs/swagger` | springdoc + `@Operation` / `@Schema` | 每個 DTO |
| 測試 | Jest + `Test.createTestingModule` | JUnit 5 + AssertJ + `@SpringBootTest` | `*IntegrationTest` |
| 套件管理 | npm + `package.json` | Maven + `pom.xml`（`mvnw` ≈ 鎖定版本的 npx） | |
| 熱重載 | `nest start --watch` | DevTools（偵測 class 變動自動重啟） | ⚠️ 見[第 16 節](#16-踩過的坑真實發生過的) |

**最大的觀念差異**：NestJS 要在 `@Module` 裡手動列出 providers；Spring 是**掃描 package**，只要加了 `@Service`，就會自動變成可注入的 Bean。好處是少寫很多樣板，壞處是「模組邊界」不會被框架強制，要靠自己守規矩（[第 14 節](#14-模組化單體模組邊界怎麼守)）。

---

## 2. Java 語法速查（給 TypeScript 工程師）

### 型別與變數

| TypeScript | Java | 備註 |
|---|---|---|
| `number` | `int`（32 位）、`long`（64 位）、`double` | **積分一律 `long`**，不用浮點數 |
| `number \| null` | `Long`、`Integer`（包裝型別，大寫） | 小寫 `long` 不能是 `null` |
| `string` | `String` | 比較用 `.equals()`，**不要用 `==`** |
| `const x = ...` | `var x = ...` / `final` | `var` 只能用在區域變數 |
| `T[]` / `Array<T>` | `List<T>` | `List.of(...)` 建立**不可變**的 list |
| `Record<K, V>` / `Map` | `Map<K, V>` | `Map.of()`、`getOrDefault(k, def)` ≈ `map.get(k) ?? def` |
| `Set` | `Set<T>` / `HashSet` | |
| 模板字串 `` `a ${b}` `` | `"a %s".formatted(b)` / `"a " + b` | 文字區塊 `"""..."""` 可多行，但**不能插值** |
| `x?.y ?? z` | `Optional.ofNullable(x).map(X::y).orElse(z)` | Repository 的 `findBy...` 常回傳 `Optional` |

### record：不可變的資料類別

```java
public record LineResult(int matched, boolean specialHit, PrizeTier tier, long prize) { }
```
- ≈ TS 的 `type LineResult = Readonly<{ matched: number; ... }>`，但是一個真正的 class
- 自動產生建構子、`matched()` 讀取方法（**不是** `getMatched()`）、`equals`、`hashCode`、`toString`
- **`equals` 比的是所有欄位**，所以測試可以直接 `assertThat(a).isEqualTo(new LineResult(...))`
- ⚠️ 建構子參數**依宣告順序**；兩個型別一樣的欄位順序放錯，編譯不會報錯
- 可以加額外建構子，但一定要 `this(...)` 呼叫主要建構子（`LeaderboardEntry` 的 4 參數版本）
- 本專案的 DTO 全部用 record

### enum：可以帶資料、帶方法

```java
public enum PrizeTier {
    FIRST(6, false), SECOND(5, true), ...;
    private final int matched;
    PrizeTier(int matched, boolean specialHit) { ... }
    public int matched() { return matched; }
}
```
- 宣告順序有意義：`Comparator.naturalOrder()` 照宣告順序比較，所以 `min` 會拿到「最高」獎級
- `values()` ≈ `Object.values(...)`
- 對 enum 的 `switch` 運算式會檢查**有沒有漏掉任何一個值**（≈ TS 的 `never` 窮舉檢查）

### switch 運算式

```java
return switch (matched) {
    case 6 -> FIRST;
    case 5 -> specialHit ? SECOND : THIRD;
    default -> null;
};
```
箭頭寫法、整個 `switch` 會回傳值、不用 `break`。

### Stream（≈ 陣列方法鏈）

| JS | Java Stream |
|---|---|
| `arr.map(f)` | `list.stream().map(f).toList()` |
| `arr.filter(f)` | `.filter(f)` |
| `arr.find(f) ?? null` | `.filter(f).findFirst().orElse(null)` |
| `arr.slice(0, 20)` | `.limit(20)` |
| `arr.reduce((s, x) => s + x.cost, 0)` | `.mapToLong(Ticket::getCost).sum()` |
| `arr.flatMap(f)` | `.flatMap(x -> x.list().stream())` |
| `_.groupBy(arr, 'userId')` | `.collect(Collectors.groupingBy(Ticket::getUserId))` |
| `new Map(arr.map(x => [x.id, x]))` | `.collect(Collectors.toMap(X::id, Function.identity()))` |
| `arr.sort((a,b) => b.p - a.p \|\| ...)` | `.sorted(Comparator.comparingLong(X::p).reversed().thenComparing(...))` |
| `x => x.cost` | `Ticket::getCost`（方法參考） |
| `Array.from({length: 49}, (_, i) => i + 1)` | `IntStream.rangeClosed(1, 49)` |

### 其他常見語法

- **可變參數** `List<Integer>... lines` ≈ `...lines: number[][]`
- **模式比對** `if (r instanceof BusinessException e && e.getErrorCode() == ...)` ≈ TS 型別守衛
- **存取範圍**：`public` / `private` / 不寫 = **package-private**（同一個 package 才看得到；測試放同 package 就能測，例如 `GameRulesService.winningCombinations`）
- **`static`**：屬於 class、不需要 `this` 的方法，≈ 模組裡的普通函式
- **`final class` + `private` 建構子**：工具類別，只能 `Combinations.choose(...)`
- **Lombok**：`@Getter @Setter @NoArgsConstructor`（Entity 用）、`@RequiredArgsConstructor`（為所有 `final` 欄位產生建構子 → 依賴注入）、`@Slf4j`（產生 `log`）

### 數字的陷阱

- **整數除法會捨去小數**：`turnover * 20 / 100`（**先乘再除**），先除的話 `30 / 100 = 0`
- **`long` 溢位不會報錯**，會默默變成錯的值；`49!` 遠超過 `long`，所以組合數用逐步乘除（`Combinations.choose`）
- `int` 不能自動變成 `Long`：`new PrizeRule(..., 9_600L, ...)` 要加 `L`
- 數字可以用底線分隔：`1_000_000`

---

## 3. Spring 核心：Bean、依賴注入、代理

### Bean 與 IoC 容器
- 加了 `@Component` / `@Service` / `@Configuration` 的 class，Spring 啟動時會**建立一個實例（Bean）**放進容器，預設是**單例**
- 需要它的地方在建構子宣告就會被注入：
  ```java
  @Service
  @RequiredArgsConstructor
  public class SettlementService {
      private final DrawService drawService;       // Spring 自動注入
      private final BettingService bettingService;
  }
  ```
- `@Configuration` + `@Bean` 方法：手動建立第三方的物件（例如 `PasswordEncoder`、`SecurityFilterChain`、排程用的 `ThreadPoolTaskScheduler`）

### 代理（Proxy）與 `@Transactional` 的陷阱 ⚠️
- `@Transactional` 是靠**代理**實作的：別的 class 拿到的 `walletService` 其實是一層包裝，呼叫時先開交易、再轉呼叫真正的方法
- **同一個 class 裡用 `this.credit()` 呼叫，會繞過代理，交易不會開**
- 本專案實測：在 `WalletService` 裡自己呼叫 `credit`，第二次撞到唯一索引時流水沒寫進去、**錢卻加上去了**（憑空多 1,000）；從 `DailyBonusService` 呼叫就會正確回滾
- 所以每日簽到放在獨立的 `DailyBonusService`
- ≈ 前端用 axios interceptor 做統一處理，但某處直接用 `fetch`，interceptor 當然不會跑

### 條件式 Bean
```java
@ConditionalOnProperty(prefix = "app.scheduling", name = "enabled", havingValue = "true", matchIfMissing = true)
```
設定不符時，這個 class 根本不會被建立。`SchedulingConfig`、`PrizeSummaryBackfill` 都用同一個開關，測試時關掉。

---

## 4. 設定：application.properties、@ConfigurationProperties、Profile

```properties
app.prize.jackpot-floor=200000
app.game.draw-interval=5m          # 自動轉成 Duration
app.auth.jwt-secret=${JWT_SECRET:dev-only-...}   # 環境變數優先，冒號後面是預設值
```

```java
@ConfigurationProperties(prefix = "app.prize")
public record PrizeProperties(long jackpotFloor, long jackpotRatePercent, ...) { }
```
- `jackpot-floor` 自動對應 `jackpotFloor`（kebab → camel）
- 主程式加 `@ConfigurationPropertiesScan` 就會自動綁定
- **好處**：設定有型別、可以直接注入；單元測試時可以直接 `new PrizeProperties(...)`
- **Profile**：`application-test.properties` 只在 `@ActiveProfiles("test")` 時生效，覆蓋同名設定（測試用 `thirtylab_test` 資料庫、關掉排程）
- **測試要固定遊戲規則**：球數、獎金在 `application-test.properties` 寫死一份（49 球、舊獎金），測試裡算死的數字才不會因為調整遊戲平衡而壞掉（≈ Jest 用 `.env.test`，不吃正式的 `.env`）
- ⚠️ 設定檔**少一行不會報錯**：`long` / `int` 欄位拿到 0、物件拿到 `null`，程式照跑、數字默默算錯（≈ `configService.get()` 拿到 `undefined`）
- **啟動時就檢查設定**：類別加 `@Validated`，欄位加 `@Min` / `@Max`，設定不合理時**後端直接啟動失敗**（fail fast，≈ `ConfigModule` 的 Joi / zod schema）
  ```java
  @Validated
  @ConfigurationProperties(prefix = "app.game")
  public record GameProperties(Duration drawInterval, Duration bettingCutoff, long pointsPerBet,
          @Min(7) @Max(99) int maxNumber) { }   // 至少 7 個號碼（6 個正碼 + 特別號碼）
  ```
- ⚠️ IntelliJ 的 `.properties` 檔編碼要設成 UTF-8（或打開 native-to-ascii），不然中文註解會變 `???`

---

## 5. Web 層：Controller、統一回應、錯誤處理、驗證

### 分層責任
| 層 | 負責 | 不該做 |
|---|---|---|
| Controller | 解析 HTTP（路徑、參數、body、目前使用者）、呼叫 Service、包成 `Result` | 業務邏輯 |
| Service | 業務規則、交易、呼叫其他模組的 Service | 碰 HTTP |
| Repository | 讀寫資料庫 | 業務判斷 |

### 統一回應 `Result<T>`
```json
{ "code": 0, "msg": "ok", "data": { ... } }
```
- 錯誤一律 `throw new BusinessException(ErrorCode.XXX)`，由 `GlobalExceptionHandler` 轉成 `{ code, msg, data }`，HTTP 狀態碼 = `code / 100`
- 5 位數錯誤碼：前 3 碼 = HTTP 狀態、後 2 碼 = 流水號（`40902` 積分不足）

### GlobalExceptionHandler 處理的例外
| 例外 | 來源 | 回應 |
|---|---|---|
| `BusinessException` | Service 主動丟 | 對應的錯誤碼 |
| `MethodArgumentNotValidException` | `@Valid` 驗證失敗 | `40001`，`data: [{ field, rule }]` |
| `MethodArgumentTypeMismatchException` | `?page=abc`、`?period=YEAR` | `40001`，`rule: "typeMismatch"` |
| `Exception` | 其他沒預期的錯誤 | `50000` |

### 驗證
```java
public record PlaceBetRequest(
    @NotBlank String drawNo,
    @NotBlank @Size(max = 64) String idempotencyKey,
    @NotEmpty List<@NotNull @Size(min = 6, max = 6) List<@NotNull @BallNumber Integer>> lines) {

    @JsonIgnore @AssertTrue
    public boolean isNumbersDistinct() { ... }   // 跨欄位的自訂規則
}
```
- 註解可以加在**泛型參數**上，驗證到陣列裡每一個元素
- `rule` 名稱來自註解（`size`、`notNull`、`assertTrue`、`ballNumber`），前端依此翻譯

### 自訂驗證註解（上限從設定讀）
註解的參數必須是**編譯時常數**，`@Max(gameProperties.maxNumber())` 寫不出來，所以自己做一個 `@BallNumber`（≈ class-validator 的 `registerDecorator` + `@ValidatorConstraint`）：
```java
@Target({ElementType.TYPE_USE, ElementType.FIELD, ElementType.PARAMETER})  // TYPE_USE 才能寫在 List<@BallNumber Integer>
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = BallNumberValidator.class)
public @interface BallNumber {
    String message() default "號碼超出範圍";
    Class<?>[] groups() default {};                    // 這三個是規定一定要有的
    Class<? extends Payload>[] payload() default {};
}

@RequiredArgsConstructor   // 不用 @Component：Spring 建立 validator 時會自動注入
public class BallNumberValidator implements ConstraintValidator<BallNumber, Integer> {
    private final GameProperties gameProperties;
    public boolean isValid(Integer value, ConstraintValidatorContext context) {
        return value == null || (value >= 1 && value <= gameProperties.maxNumber());  // null 交給 @NotNull
    }
}
```
- Validator 本身是普通 class，單元測試直接 `new BallNumberValidator(new GameProperties(...))`
- 原本用到常數的 `static` 方法要讀設定時，得改成**實例方法**（static 方法沒有 `this`，讀不到注入的欄位）

---

## 6. Spring Security + JWT Cookie + 單一 Session

### 一個請求進來時
1. `JwtCookieFilter`（自訂 filter）讀 cookie `tl_token` → 驗證 JWT 簽名
2. 用 JWT 的 `subject`（userId）去 Redis 讀 `session:{userId}`，跟 JWT 的 `id`（sessionId）比對
3. 一致 → 把 userId 放進 `SecurityContext`；不一致 → 記下「被踢掉了」（之後回 `40102`）
4. `SecurityConfig` 的規則決定這個路徑要不要登入（`permitAll` 清單）
5. 沒登入卻要登入 → `authenticationEntryPoint` 交給 `GlobalExceptionHandler` 回 `40100` / `40102`
6. Controller 用 `@AuthenticationPrincipal String userId` 拿到 userId（沒登入是 `null`）

### 單一 Session（後登入的踢掉前一個）
- 登入時產生新的 sessionId，用 Redis 的 `SET ... GET`（**原子地**寫入新值、拿回舊值）
- 拿到舊值 → 透過 WebSocket 對舊 session 推 `SESSION_REPLACED`
- 舊瀏覽器下一次打 API，Redis 裡的 sessionId 已經不同 → `40102`

### 為什麼 JWT 放 HttpOnly cookie
- JS 讀不到 → XSS 偷不走
- `SameSite=Lax` → 擋大部分 CSRF；本專案的寫入 API 都是 `POST` + JSON

### 公開路徑
`SecurityConfig` 裡 `requestMatchers(HttpMethod.GET, "/api/draws/**", "/api/jackpot", "/api/leaderboard/**", "/api/game/rules").permitAll()`。新增公開 API **一定要記得加**（漏過兩次）。

---

## 7. MongoDB vs PostgreSQL

| PostgreSQL | MongoDB | 本專案 |
|---|---|---|
| database | database | `thirtylab` |
| table | collection | `draws`、`tickets`… |
| row | document（BSON ≈ JSON） | |
| column | field（每份文件可以不一樣） | 舊期數沒有 `prizeSummary` |
| JOIN | `$lookup`（少用） / 在程式裡組合 | 見[第 14 節](#14-模組化單體模組邊界怎麼守) |
| 子表（1 對多） | **嵌入陣列 / 子文件** | 注單的 `lines`、`results`；期數的 `prizeSummary` |
| `UNIQUE` | 唯一索引 | `type + refId` |
| `SERIAL` / UUID | `ObjectId`（`_id`） | |
| 交易 | 交易（**需要副本集**） | docker-compose 用單節點副本集 `rs0` |
| `NULL` | `null` 或**欄位不存在** | `IsNull` 兩種都會找到 |

**什麼時候嵌入、什麼時候分開**
- **嵌入**：一起讀、一起寫、不會無限增長 → 一張注單的 `lines`（最多 50 注）、`results`
- **分開**：會無限增長、要單獨查詢 → 積分流水 `wallet_transactions`（不放在錢包文件裡）

---

## 8. Spring Data MongoDB：Repository 與 MongoTemplate

### Repository：用方法名稱產生查詢
```java
Optional<Draw> findFirstByStatusAndDrawAtBeforeOrderByDrawAtDesc(DrawStatus status, Instant drawAt);
// ≈ db.draws.find({ status, drawAt: { $lt: drawAt } }).sort({ drawAt: -1 }).limit(1)

boolean existsByTypeAndRefId(WalletTransactionType type, String refId);
long countByStatusIn(Collection<DrawStatus> statuses);
List<Draw> findByStatusAndPrizeSummaryIsNull(DrawStatus status);
```
| 關鍵字 | 意思 |
|---|---|
| `findBy` / `findFirstBy` | 查多筆 / 第一筆 |
| `existsBy` / `countBy` | 布林 / 數量 |
| `And` / `In` / `Before` / `IsNull` | 條件 |
| `OrderByXxxDesc` | 排序 |
| `Pageable` 參數 | 分頁 |

### MongoTemplate：Repository 做不到的時候
- **條件更新**（狀態機的核心）：
  ```java
  Query q = Query.query(Criteria.where("drawNo").is(drawNo).and("status").is(DrawStatus.DRAWN));
  Update u = new Update().set("status", DrawStatus.SETTLED).set(...);
  mongoTemplate.findAndModify(q, u, FindAndModifyOptions.options().returnNew(true), Draw.class);
  ```
  ≈ `UPDATE draws SET status='SETTLED' WHERE draw_no=? AND status='DRAWN' RETURNING *`
- `updateFirst(...).getModifiedCount()` ≈ affected rows
- `$inc` 加減餘額：`new Update().inc("balance", -amount)`，配合條件 `balance >= amount` → 餘額檢查和扣款是**同一個原子操作**
- 聚合：`mongoTemplate.aggregate(...)`（[第 11 節](#11-聚合管線aggregation-pipeline)）

### Auditing
`@CreatedDate` / `@LastModifiedDate` 自動填時間。⚠️ 測試想指定 `createdAt` 時，要繞過 Repository，直接 `mongoTemplate.insert(new Document(...), "wallet_transactions")`。

### `_class` 欄位
Spring Data 存每份文件時會多寫一個 `_class: "com.thirtylab.draw.model.Draw"`（完整的類別名稱），讀回來時用它決定要建立哪個類別（有繼承、多型時才真的需要）。
- 代價：**資料庫裡記著 Java 套件名稱**。上線後再改套件或搬類別，舊文件的 `_class` 就對不上，要寫遷移腳本更新，所以套件改名趁還沒上線做（2026-10-23 從 `com.marksixlab` 改成 `com.thirtylab` 時，資料庫是一起換新的）
- 不需要多型的話可以設定 `MappingMongoConverter` 不寫 `_class`，本專案沒有關掉

---

## 9. 索引設計與 explain

### 本專案的索引
| 集合 | 索引 | 用途 |
|---|---|---|
| `users` | `username`（唯一） | 登入、檢查重複 |
| `wallets` | `userId`（唯一） | 一人一個錢包 |
| `wallet_transactions` | `type + refId`（唯一） | **冪等**：同一件事只記一次 |
| | `userId + createdAt` | 我的流水 |
| | `type + createdAt` | 排行榜：某段時間的派彩 |
| `tickets` | `userId + idempotencyKey`（唯一） | 下注冪等 |
| | `userId + createdAt` | 我的注單 |
| | `drawNo + status` | 結算、中獎名單 |
| | `userId + status + settledAt` | 最近 N 次中獎 |
| `draws` | `drawNo`（唯一）、`drawAt` | 期數 |

### ESR 規則（複合索引的欄位順序）
**E**quality（等於）→ **S**ort（排序）→ **R**ange（範圍）。
- `userId + status + settledAt`：等於、等於、排序
- `type + createdAt`：等於、範圍
- 複合索引要**從最左邊的欄位開始用**：查詢沒有 `userId`，`userId_createdAt` 就用不上

### 怎麼確認有沒有用到索引
```js
db.tickets.explain("executionStats").aggregate([...])
```
看 `IXSCAN`（有用索引）vs `COLLSCAN`（全表掃描）、`indexName`、`totalDocsExamined`。例：加了 `userId_status_settledAt` 之後，「最近中獎」只讀中獎的注單，沒中獎的完全不讀。

---

## 10. 交易、並發與冪等

這是這個專案**最有價值**的一塊。核心思想：**每一步都可以安全重跑**。

### 三種冪等手段
| 手段 | 怎麼做 | 例子 |
|---|---|---|
| 唯一索引 | 重複寫入會撞到 `DuplicateKeyException` | 派彩流水 `PAYOUT + 注單 id`；簽到 `DAILY_BONUS + userId:日期` |
| 條件更新 | `WHERE status = 舊狀態` | 注單 `PENDING → WON`、期數 `DRAWN → SETTLED` |
| 冪等鍵 | 前端每次送出產生 UUID，重送沿用 | 下注 `idempotencyKey` |

### 結算為什麼不包成一個大交易
一期可能有上千張注單，Mongo 交易有時間和大小限制。改成「每一小步都可以重跑」：
1. 判獎：只改 `PENDING` 的注單
2. 派彩：唯一索引擋重複
3. 標記已派：只改 `WON` 的注單
4. **最後**才把期數改成 `SETTLED`

中途當機 → 期數還是 `DRAWN` → 下一秒排程重跑 → 做過的步驟自動跳過。

### 交易的使用
- 下注：建立注單 + 扣餘額 + 寫流水，**三件一起成功或一起失敗**（`TransactionTemplate`）
- 派彩、簽到：`WalletService.credit` 是 `@Transactional`（加餘額 + 寫流水）

### 並發衝突（WriteConflict）
- 兩個交易同時改同一份文件 → 其中一個拋 WriteConflict（Spring 包成 `DataIntegrityViolationException`）
- 處理：**重試**（3 次，50ms、100ms），而且**每次重試前先查**（已經有人成功了就直接回結果）
- ⚠️ `DuplicateKeyException` 是 `DataIntegrityViolationException` 的**子類別**：`catch` 要**子類別寫在前面**，或在最靠近的地方先轉成業務錯誤

---

## 11. 聚合管線（Aggregation Pipeline）

資料從上往下流過每個 stage，≈ 一連串的 SQL 子查詢 / 陣列方法鏈。

| Stage | SQL 對照 | 本專案用在 |
|---|---|---|
| `$match` | `WHERE` | 全部 |
| `$sort` / `$limit` | `ORDER BY` / `LIMIT` | 冷熱號碼 |
| `$project` | `SELECT 欄位 AS ...` | 冷熱號碼、富豪榜 |
| `$unwind` | `CROSS JOIN LATERAL unnest(...)` | 冷熱號碼（一期拆成 7 顆球） |
| `$group` | `GROUP BY` + `SUM` / `MIN` | 冷熱號碼、中獎榜 |
| `$setWindowFields` + `$documentNumber` | `ROW_NUMBER() OVER (...)` | 冷熱號碼（第幾期前開出） |
| `$setWindowFields` + `$rank` | `RANK() OVER (...)`（同分同名次） | 排行榜 |
| `$topN`（在 `$group` 裡） | `ROW_NUMBER() OVER (PARTITION BY ...) <= N` | 最近 10 次中獎 |
| `$lookup` | `JOIN` / `EXISTS` 子查詢 | 富豪榜：只列下注過的人 |

### 在 Java 裡寫
```java
Aggregation.newAggregation(
    Aggregation.match(Criteria.where("type").is(PAYOUT).and("createdAt").gte(from).lt(to)),  // 有型別
    Aggregation.group("userId").sum("amount").as("amount"),
    Aggregation.stage("""
        { $setWindowFields: { sortBy: { amount: -1 }, output: { rank: { $rank: {} } } } }
        """));                                                                                // 原生語法
```
- 簡單的 stage 用 Java 方法（有型別、enum 自動轉字串）
- 複雜的 stage 用 `Aggregation.stage("""...""")` 直接貼 Mongo 語法，**先在 DataGrip 試好再貼進來**
- ⚠️ 字串 stage 產生的新欄位，Spring 不認得，後面要用它（例如 `$sort: { rank: 1 }`）也要用字串 stage
- 結果用 record 接，`$group` 的 `_id` 用 `@Id` 對應：`record UserRank(@Id String userId, long amount, int rank)`

### 什麼時候不用聚合
「最高獎級」要比 enum 的順序，Mongo 裡存的是字串（`"FIFTH"` < `"FOURTH"` 字串比較會錯）。資料量小（一期幾十張注單）就**拿回 Java 處理**（`DrawWinnersService`）。

---

## 12. 排程與「每秒對帳」

```java
@Scheduled(fixedDelay = 1000)       // 上一次跑完後等 1 秒再跑
public void tick() { drawService.tick(Instant.now()); }
```

**對帳（reconcile）思維**，而不是「在某個時間點觸發一次」：
- 每秒檢查：該開的期數開了沒？該截止的截止了沒？該開獎的開了沒？該結算的結算了沒？
- 好處：伺服器停了 10 分鐘再啟動，會**自動補做**錯過的事（補開獎、照時間順序補結算）
- 狀態轉換全部是條件更新，所以重複執行安全；多台伺服器同時跑也安全（因此不需要 ShedLock）

### 時間的處理
- 一律存 `Instant`（UTC 時間點），截斷到毫秒
- 「今天」「本週」用 `LocalDate.ofInstant(now, ZoneOffset.UTC)` 計算，`TemporalAdjusters.previousOrSame(MONDAY)` 找週一
- **時間由外面傳進 Service**（`now` 參數），測試時可以直接傳「23:59:59.999」測邊界

---

## 13. WebSocket（STOMP）推播

| 目的地 | 誰會收到 | 內容 |
|---|---|---|
| `/topic/draws` | 所有連線的人（不用登入） | `OPENED`、`CLOSED`、`DRAWN`、`SETTLED` + 期數資料 |
| `/user/queue/session` | 特定的 session | `SESSION_REPLACED`（被踢下線） |

- 後端：`SimpMessagingTemplate.convertAndSend(topic, payload)`、`convertAndSendToUser(sessionId, "/queue/session", ...)`
- 握手時 `SessionHandshakeHandler` 把 sessionId 當成 WebSocket 的使用者名稱，才能「推給特定 session」
- 前端直連 `ws://localhost:8088/ws`，不經過 Next.js
- 限制：用的是**記憶體內的 broker**，多台伺服器時 A 機推的訊息，連在 B 機的人收不到 → 要擴展時換 RabbitMQ / Redis

---

## 14. 模組化單體：模組邊界怎麼守

規則：**模組之間只透過 Service 呼叫，不直接用別人的 Repository、不 `$lookup` 別人的集合**。

```
stats ──→ wallet、account、betting、draw
settlement ──→ draw、betting、wallet
betting ──→ draw、wallet
rules ──→ settlement（PrizeCalculator）、config
draw ──（不依賴其他業務模組）
```

- **依賴只能單向**：`betting` 依賴 `draw`（下注要檢查期數），所以 `draw` 不能反過來查注單。需要「期數 + 注單」的功能放在更上層（`settlement`、`stats`）
- **在程式裡組合 vs `$lookup`**：排行榜的暱稱屬於 `account`，所以是 `stats` 分別呼叫 `WalletService` 和 `UserService` 再組合；富豪榜的 `$lookup` 是 `wallets` 接 `wallet_transactions`，**同一個模組**，所以可以
- **URL 跟模組不一定一致**：`/api/draws/{drawNo}/winners` 的 Controller 在 `stats`，因為它要組合三個模組的資料
- 共用的值型別（例如 `PrizeTier` enum）可以被引用，不算循環依賴

---

## 15. 測試

| 種類 | 寫法 | 速度 | 例子 |
|---|---|---|---|
| 單元測試 | 直接 `new Service(假的依賴)` | 毫秒 | `PrizeCalculatorTest`、`GameRulesServiceTest` |
| 整合測試 | `@SpringBootTest @ActiveProfiles("test")`，連真的 Mongo（`thirtylab_test`） | 秒 | `SettlementServiceIntegrationTest` |
| HTTP 層測試 | `MockMvc`（**還沒寫**） | | 會抓到「Controller 漏寫」「公開路徑漏加」 |

### 常用寫法
```java
@ParameterizedTest
@CsvSource({ "1 2 3 4 5 6, 6, false, FIRST, 123456", ... })   // ≈ Jest 的 test.each
void judgesEachTier(String line, int matched, boolean specialHit, PrizeTier tier, long prize) { ... }

assertThat(result).isEqualTo(new LineResult(...));            // record 一次比全部欄位
assertThat(list).extracting(RecentWin::drawNo).containsExactly(...);
assertThatThrownBy(() -> ...).isInstanceOfSatisfying(BusinessException.class, e -> ...);
```

### 原則
- 測試資料要**刻意設計**：邊界（23:59:59.999 / 00:00:00）、同分、超過上限（要測「最多 10 筆」就放 12 筆）
- **把數字算死**：`getPayout` 和 `getCost` 打錯，只有「彩池應該是 1,500,010」這種測試抓得到
- 並發測試：5 個執行緒同時下注 / 簽到，檢查只成功一次
- 每個測試在 `@BeforeEach` 清資料，**不要在 `@AfterAll` 刪資料庫**（Spring context 跨測試類別共用，索引只在啟動時建立）
- **每個 `@SpringBootTest` 都要 `@ActiveProfiles("test")`**，不然會連到真實資料庫

---

## 16. 踩過的坑（真實發生過的）

| 現象 | 原因 | 解法 |
|---|---|---|
| IntelliJ 自動 import 錯 class | `Result`、`Update`、`Id` 都有同名的 | 看 import 的套件名稱：`org.springframework.data...` |
| `cannot find symbol: Comparator` | 少 import | 看到 `cannot find symbol` 先懷疑 import |
| `.properties` 中文變 `???` | IntelliJ 用 ISO-8859-1 存檔 | File Encodings 設 UTF-8 |
| 所有 API 都 401，header 有 `WWW-Authenticate: Basic` | DevTools 重啟時 `SecurityConfig` 沒載入，Spring 用了預設安全設定 | **完整停止再啟動** |
| 新 API 不登入回 `40100` | `SecurityConfig` 沒加到 `permitAll` | 新增公開 API 要同時改 `SecurityConfig` |
| `No static resource api/...` 404 | Controller 方法沒寫 / 路徑打錯 | 檢查 `@GetMapping` |
| 測試全過但 HTTP 不通 | Service 測試不經過 HTTP 和 Security | 實際打 API 驗證；之後補 MockMvc 測試 |
| 彩池少算 20% | 計算投注額時該用 `Ticket::getCost`，打成了 `Ticket::getPayout`（兩個都是 `long`，編譯器抓不到） | 把數字算死的測試 |
| 彩池完全不會增加（結算測試差 10、差 7） | 改獎金時不小心刪掉 `app.prize.jackpot-rate-percent`，`long` 欄位拿到預設值 0，不會報錯 | 測試 profile 固定規則；設定類加 `@Validated` + `@Min` 讓它啟動就失敗 |
| `@Transactional` 沒作用、錢憑空增加 | 同 class 自己呼叫，繞過代理 | 放到另一個 Service |
| 並發簽到出現 500 | WriteConflict 一直重試失敗 | 重試前先查「已經領過」 |
| 測試寫進了真實資料庫 | `contextLoads` 測試沒加 test profile，啟動時的補算在真實 DB 執行 | 全部 `@SpringBootTest` 加 `@ActiveProfiles("test")` |
| 在 `@AfterAll` 刪測試 DB，下一個測試類別的唯一索引不見了 | Spring context 共用，索引只在啟動時建立 | 只在 `@BeforeEach` 清資料 |

---

## 17. 面試可以講的設計點

1. **冪等的結算流程**：不用大交易，用「條件更新 + 唯一索引」讓每一步可以重跑，當機後自動接續
2. **每秒對帳的排程**：狀態機驅動，停機後自動補做；條件更新讓多台同時跑也安全，所以不需要分散式鎖
3. **並發安全的扣款**：`balance >= cost` 條件 + `$inc` 原子操作；下注用冪等鍵處理重送；WriteConflict 重試前先查
4. **單一 session 登入**：JWT（HttpOnly cookie）+ Redis 存目前 session，原子的 `SET...GET` 拿到被踢的那個，再用 WebSocket 通知
5. **模組化單體**：模組間只透過 Service、依賴單向；什麼時候用 `$lookup`、什麼時候在程式裡組合
6. **索引設計**：ESR 規則、用 `explain` 驗證、為每個查詢設計索引
7. **讀多寫少的資料在寫入時算好**：每期獎級統計在結算時存起來，配合可重複執行的補算
8. **前後端契約**：OpenAPI 匯出 → 前端產生型別；統一回應格式、5 位數錯誤碼、i18n 在前端
9. **@Transactional 自我呼叫的陷阱**：有實際重現的數據
