# 05 第一支 API：從網址到資料庫再回來

這一章只看一支最簡單的 API：**`GET /api/wallet`（我的積分餘額）**，把它經過的每一個 class 都打開來看。看懂這一支，其他 API 都是同一個模式。

## 1. 先打一次看結果

登入之後，在 Swagger 或瀏覽器打 `GET http://localhost:3100/api/wallet`：

```json
{ "code": 0, "msg": "ok", "data": { "balance": 10000 } }
```

這個 JSON 是怎麼來的？

## 2. 全程地圖

```
瀏覽器  GET /api/wallet  （cookie: tl_token=eyJ...）
  │
  ▼
① Tomcat（內建的 HTTP 伺服器）收到請求
  │
  ▼
② Security Filter Chain
   └─ JwtCookieFilter：讀 cookie → 驗證 JWT → 查 Redis → 記下「這個請求是 userId = 6adb...」  （第 7 章）
   └─ 授權規則：/api/wallet 要登入 → 已登入，放行
  │
  ▼
③ DispatcherServlet：找出哪個 Controller 方法負責 GET /api/wallet
  │
  ▼
④ WalletController.balance(userId)          ← Controller 層：只處理 HTTP
  │
  ▼
⑤ WalletService.balance(userId)             ← Service 層：業務規則
  │
  ▼
⑥ WalletRepository.findByUserId(userId)     ← Repository 層：讀資料庫
  │
  ▼
⑦ MongoDB：db.wallets.findOne({ userId: "6adb..." })
  │
  ▲ 回程
⑧ Wallet 物件 → WalletResponse(10000) → Result.ok(...)
  │
  ▼
⑨ Jackson 把 Result 轉成 JSON，寫進 HTTP 回應
```

NestJS 對照：`Middleware → Guard → Controller → Service → Repository`，幾乎一模一樣。

下面從 ④ 開始一個一個看（① ② ③ 是框架做的）。

## 3. ④ Controller：只處理 HTTP

```java
// wallet/controller/WalletController.java
@RestController                                    // ①
@RequestMapping("/api/wallet")                     // ②
@RequiredArgsConstructor
@Tag(name = "Wallet", description = "積分餘額、積分流水")   // ③
public class WalletController {

    private final WalletService walletService;     // ④
    private final DailyBonusService dailyBonusService;

    @GetMapping                                    // ⑤
    @Operation(summary = "我的積分餘額")            // ⑥
    public Result<WalletResponse> balance(@AuthenticationPrincipal String userId) {   // ⑦
        return Result.ok(walletService.balance(userId));                              // ⑧
    }
    ...
}
```

| 編號 | 程式碼 | 意思 | NestJS 對照 |
|---|---|---|---|
| ① | `@RestController` | 這個 class 處理 HTTP，方法的回傳值**直接轉成 JSON** | `@Controller()` |
| ② | `@RequestMapping("/api/wallet")` | 這個 class 所有方法的網址前綴 | `@Controller('api/wallet')` |
| ③ | `@Tag` | Swagger 上的分組名稱 | `@ApiTags('Wallet')` |
| ④ | `private final WalletService` | 依賴注入（第 3 章） | constructor 注入 |
| ⑤ | `@GetMapping` | 處理 `GET`，網址就是前綴本身 `/api/wallet` | `@Get()` |
| ⑥ | `@Operation` | Swagger 上的說明 | `@ApiOperation` |
| ⑦ | `@AuthenticationPrincipal String userId` | **目前登入的使用者 id**，由 `JwtCookieFilter` 設定（第 7 章） | 自訂的 `@User()` decorator |
| ⑧ | `Result.ok(...)` | 包成 `{ code: 0, msg: "ok", data }` | 自己寫的 interceptor |

**Controller 只做三件事**：從 HTTP 拿參數 → 呼叫 Service → 包成 `Result`。不寫任何業務規則，所以每個方法都只有一兩行。

### 其他參數怎麼拿

同一個 class 的另一個方法：

```java
@GetMapping("/transactions")                                    // GET /api/wallet/transactions
public Result<PageResult<WalletTransactionResponse>> transactions(
        @AuthenticationPrincipal String userId,
        @RequestParam(defaultValue = "1") int page,             // ?page=2，沒給就是 1
        @RequestParam(defaultValue = "20") int size) {          // ?size=50，沒給就是 20
    return Result.ok(walletService.transactions(userId, page, size));
}
```

| 想拿什麼 | Spring | NestJS | 專案例子 |
|---|---|---|---|
| 網址上的 query `?page=2` | `@RequestParam int page` | `@Query('page')` | 分頁 |
| 網址路徑的一段 `/draws/{drawNo}` | `@PathVariable String drawNo` | `@Param('drawNo')` | `DrawWinnersController` |
| JSON body | `@Valid @RequestBody PlaceBetRequest req` | `@Body() dto` | `TicketController.place`（第 6 章） |
| 目前使用者 | `@AuthenticationPrincipal String userId` | `@User()` | 幾乎每個需要登入的 API |

> `?page=abc` 這種轉不成 `int` 的值，Spring 會丟 `MethodArgumentTypeMismatchException`，被 `GlobalExceptionHandler` 轉成 `40001` + `rule: "typeMismatch"`（第 6 章）。

### 為什麼 Controller 裡呼叫 `Instant.now()`，不在 Service 裡？

```java
@PostMapping("/daily-bonus")
public Result<ClaimDailyBonusResponse> claimDailyBonus(@AuthenticationPrincipal String userId) {
    return Result.ok(dailyBonusService.claim(userId, Instant.now().truncatedTo(ChronoUnit.MILLIS)));
}
```

時間從外面傳進 Service，**測試時就能傳任何時間**，例如「23:59:59.999」來測跨日的邊界。如果 Service 自己呼叫 `Instant.now()`，測試就沒辦法控制時間了。

## 4. ⑤ Service：業務規則

```java
// wallet/service/WalletService.java
public WalletResponse balance(String userId) {
    return new WalletResponse(getOrOpen(userId).getBalance());
}

public Wallet getOrOpen(String userId) {
    return walletRepository.findByUserId(userId)        // Optional<Wallet>
            .orElseGet(() -> open(userId));             // 找不到就開戶
}
```

- `getOrOpen`：有錢包就回傳，沒有就**開一個新的並送註冊獎勵**（`open` 的細節在第 8 章）
- `balance`：只取出餘額，包成 `WalletResponse`

**為什麼要「沒有就開戶」？** 註冊時會開錢包，但萬一註冊到一半當機、錢包沒建成功，之後第一次查餘額時會自動補上。這種「讀的時候順便修好」的寫法讓系統更耐用。

## 5. ⑥ Repository：讀資料庫

```java
// wallet/repository/WalletRepository.java
public interface WalletRepository extends MongoRepository<Wallet, String> {
    Optional<Wallet> findByUserId(String userId);
}
```

- `MongoRepository<Wallet, String>`：讀寫 `Wallet`，`id` 的型別是 `String`
- 繼承之後**自動擁有** `findById`、`findAll`、`save`、`insert`、`deleteById`、`count`……
- `findByUserId`：Spring Data 看方法名稱，自動產生查詢 `db.wallets.findOne({ userId: ? })`

## 6. ⑦ 資料庫裡長怎樣

`Wallet` 對應 MongoDB 的 `wallets` 集合：

```java
// wallet/model/Wallet.java
@Document("wallets")                 // 存在 wallets 集合
public class Wallet {
    @Id private String id;           // 對應 _id
    @Indexed(unique = true)
    private String userId;           // 唯一索引：一個人只有一個錢包
    private long balance;
    @CreatedDate private Date createdAt;
    @LastModifiedDate private Instant updatedAt;
}
```

在 MongoDB Compass 裡看到的文件：

```json
{
  "_id": { "$oid": "6adb1a816ae6eccdf16f4d02" },
  "userId": "6adb1a816ae6eccdf16f4d01",
  "balance": 10000,
  "createdAt": { "$date": "2026-10-23T08:27:45.739Z" },
  "updatedAt": { "$date": "2026-10-23T08:27:45.739Z" },
  "_class": "com.thirtylab.wallet.model.Wallet"
}
```

`_class` 是 Spring Data 自己加的，記錄 Java 類別名稱（第 8 章）。

## 7. ⑧ 回程：Model → DTO → Result

```java
// wallet/dto/WalletResponse.java
public record WalletResponse(
        @Schema(description = "積分餘額", requiredMode = REQUIRED, example = "10000")
        long balance
) { }
```

- **DTO 只放前端需要的欄位**。`Wallet` 有 `id`、`userId`、`createdAt`，但 API 只回 `balance`
- `@Schema` 是給 Swagger 看的說明；`requiredMode = REQUIRED` 讓前端產生的 TypeScript 型別是 `balance: number`，而不是 `balance?: number`

然後 Controller 包一層 `Result`：

```java
// common/Result.java
public record Result<T>(int code, String msg, T data) {
    public static <T> Result<T> ok(T data) {
        return new Result<>(0, "ok", data);
    }
}
```

## 8. ⑨ Jackson：Java 物件 → JSON

Controller 回傳 `Result<WalletResponse>`，Spring 用 **Jackson**（Java 最常用的 JSON 套件）把它轉成 JSON：

| Java | JSON |
|---|---|
| record 的每個欄位 `code`、`msg`、`data` | 同名的 key |
| `long 10000` | `10000` |
| `Instant` | `"2026-10-23T08:27:45.739Z"`（ISO 字串，UTC） |
| enum `PrizeTier.SECOND` | `"SECOND"` |
| `null` 的欄位 | `null`（有些 DTO 設定成不輸出） |
| `List<Integer>` | `[1, 2, 3]` |

反過來，`@RequestBody` 收到的 JSON 也是 Jackson 轉成 Java 物件的。

≈ NestJS 自動 `JSON.stringify` 回傳值；`class-transformer` 負責反方向。

## 9. 分頁：`GET /api/wallet/transactions`

```java
// wallet/service/WalletService.java
public PageResult<WalletTransactionResponse> transactions(String userId, int page, int size) {
    getOrOpen(userId);
    Pageable pageable = Pagination.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
    return PageResult.of(
            transactionRepository.findByUserId(userId, pageable)        // Page<WalletTransaction>
                    .map(WalletTransactionResponse::from));             // 每一筆 model 轉成 DTO
}
```

1. `Pagination.of(page, size, sort)`：把前端的頁碼轉成 Spring 的 `Pageable`
   ```java
   // common/Pagination.java
   int safePage = Math.max(page, 1);                         // 頁碼最小 1
   int safeSize = Math.min(Math.max(size, 1), MAX_SIZE);     // 每頁 1~100 筆，避免有人要一百萬筆
   return PageRequest.of(safePage - 1, safeSize, sort);      // ⚠️ Spring 的頁碼從 0 開始！
   ```
2. Repository 方法多一個 `Pageable` 參數，就會自動分頁，並回傳 `Page<T>`（裡面有資料和總筆數）
   ```java
   Page<WalletTransaction> findByUserId(String userId, Pageable pageable);
   // ≈ db.wallet_transactions.find({ userId }).sort({ createdAt: -1 }).skip((page-1)*size).limit(size)
   //   再加上 db.wallet_transactions.countDocuments({ userId })
   ```
3. `PageResult.of(page)`：轉成我們跟前端約定的格式，**頁碼轉回從 1 開始**
   ```java
   // common/PageResult.java
   return new PageResult<>(page.getContent(), page.getTotalElements(), page.getNumber() + 1, page.getSize());
   ```

回應：

```json
{ "code": 0, "msg": "ok",
  "data": { "list": [ { "type": "SIGNUP_BONUS", "amount": 10000, "balanceAfter": 10000,
                        "refId": "6adb1a816ae6eccdf16f4d01", "createdAt": "2026-10-23T08:27:45.739Z" } ],
            "total": 1, "page": 1, "size": 20 } }
```

## 10. 三層各自負責什麼

| 層 | 負責 | **不該**做 | 這支 API 裡 |
|---|---|---|---|
| Controller | HTTP：網址、參數、目前使用者、包成 `Result` | 業務規則 | `WalletController.balance` |
| Service | 業務規則、交易、呼叫其他模組的 Service | 碰 HTTP（不知道 cookie、header） | `WalletService.balance` / `getOrOpen` |
| Repository | 讀寫資料庫 | 業務判斷 | `WalletRepository.findByUserId` |

**為什麼要分這麼細？** Service 不知道 HTTP 的存在，所以：
- 排程（`SettlementTicker`）可以直接呼叫 `walletService.credit(...)` 派彩，不用經過 HTTP
- 測試可以直接呼叫 Service，不用模擬 HTTP 請求

## 11. 新增一支 API 的檢查清單

以後自己加 API 時照這個順序：

1. **DTO**：在 `dto/` 建 record，欄位加 `@Schema(..., requiredMode = REQUIRED)`
2. **Service**：寫業務邏輯，錯誤用 `throw new BusinessException(ErrorCode.XXX)`
3. **Controller**：加方法、`@GetMapping` / `@PostMapping`、`@Operation`，body 前面要有 `@Valid`
4. **不用登入的 API**：記得加進 `SecurityConfig` 的 `permitAll`（**這個專案漏過兩次**，症狀是不登入就回 `40100`）
5. **測試**：Service 的單元或整合測試
6. **實際打一次**：Swagger 或 curl，**測試全過不代表 HTTP 會通**
7. **交接**：匯出 `docs/api/openapi.json`、寫 `docs/api-changelog.md`

---

## 小練習

1. **用中斷點看一次完整的流程**：
   - 在 `WalletController.balance` 的 `return` 那一行設中斷點
   - 用 Debug 模式啟動後端
   - 從 Swagger（先登入）打 `GET /api/wallet`
   - 停下來後看 `userId` 的值，然後按 `F7` 進入 `walletService.balance`，再按 `F7` 進入 `getOrOpen`，一路看到 Repository
2. 打 `GET /api/wallet/transactions?page=0&size=1000`，回來的 `page`、`size` 是多少？為什麼？
3. 打 `GET /api/wallet/transactions?page=abc`，看看回應。是哪個 class 產生這個回應的？
4. 想像要加一支 `GET /api/wallet/today-payout`（今天總共中了多少積分），列出要改哪些檔案（不用真的寫）。

上一章：[04 設定檔](04-configuration.md)　下一章：[06 驗證與錯誤處理](06-validation-errors.md)
