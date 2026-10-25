# 06 驗證與錯誤處理

## 1. 要解決什麼問題

- **驗證**：前端雖然會檢查「號碼 1~30、6 個不重複」，但任何人都可以用 Postman 直接送 `[[0, 0, 99, -1]]` 給後端。**後端一定要自己再檢查一次**。
- **錯誤處理**：出錯時要回前端看得懂的格式，而不是一大串 Java 的錯誤訊息。

這個專案的約定（根目錄 `CLAUDE.md`）：

```json
{ "code": 40902, "msg": "積分不足", "data": null }
{ "code": 40001, "msg": "欄位格式不符", "data": [ { "field": "lines[0][5]", "rule": "ballNumber" } ] }
```

- `code`：5 位數。**前 3 碼 = HTTP 狀態碼**、後 2 碼 = 流水號（`00` 是通用錯誤）
- `msg`：給開發看的中文；**畫面上顯示的文字由前端依 `code` 翻譯**（i18n 在前端）
- `data`：驗證錯誤時是 `[{ field, rule }]`，前端用 `rule` 決定顯示什麼

## 2. 驗證：在 DTO 上加註解

### 下注的請求

下注有三種玩法，每種玩法填不同的欄位（規則見 [game-rules.md](../../game-rules.md#玩法)）：

```java
// betting/dto/PlaceBetRequest.java（Swagger 註解省略）
public record PlaceBetRequest(
        @NotBlank                                   // 不能是 null、""、"   "
        String drawNo,

        @NotBlank @Size(max = 64)                   // 不能空白，最多 64 個字
        String idempotencyKey,

        BetType betType,                            // SINGLE / MULTIPLE / BANKER，不填是 SINGLE

        // 單式：每一注 6 個號碼
        List<@NotNull @Size(min = 6, max = 6) List<@NotNull @BallNumber Integer>> lines,
        //   ▲ 每一注：不能是 null、剛好 6 個    ▲ 每個號碼：不能是 null、1 ~ maxNumber

        @Size(min = 7)                              // 複式：至少 7 個號碼
        List<@NotNull @BallNumber Integer> numbers,

        @Size(min = 1, max = 5)                     // 膽拖的膽：1~5 個
        List<@NotNull @BallNumber Integer> bankers,

        @Size(min = 1)                              // 膽拖的拖
        List<@NotNull @BallNumber Integer> legs) {

    @JsonIgnore
    public BetType type() {
        return betType == null ? BetType.SINGLE : betType;     // 沒填就是單式，舊的前端不用改
    }

    @JsonIgnore          // 不要出現在 JSON 和 Swagger 裡
    @AssertTrue          // 這個方法回傳 false 就算驗證失敗
    public boolean isSelectionMatchesBetType() {               // 每種玩法只能填自己的欄位
        return switch (type()) {
            case SINGLE -> lines != null && !lines.isEmpty() && numbers == null && bankers == null && legs == null;
            case MULTIPLE -> numbers != null && lines == null && bankers == null && legs == null;
            case BANKER -> bankers != null && legs != null && lines == null && numbers == null;
        };
    }

    @JsonIgnore
    @AssertTrue
    public boolean isLegsEnough() {                            // 膽 + 拖至少 7 個
        if (bankers == null || legs == null) {
            return true;                            // 沒填交給上面那條處理，這裡不重複報錯
        }
        return bankers.size() + legs.size() > PICK_COUNT;
    }

    @JsonIgnore
    @AssertTrue
    public boolean isNumbersDistinct() { ... }                 // 每一注、複式的號碼、膽 + 拖合起來，都不能重複
}
```

**為什麼 `numbers`、`bankers` 上的 `@Size` 不會讓單式失敗？** Bean Validation 的慣例是 **null 一律算通過**（除了 `@NotNull` 這類專門檢查 null 的）。單式沒填 `numbers`，`@Size(min = 7)` 就不檢查。「這個玩法一定要填哪些欄位」交給 `isSelectionMatchesBetType` 一次判斷。

**`@AssertTrue` 方法的 `field` 是方法名稱去掉 `is`**：`isLegsEnough` → `legsEnough`、`isSelectionMatchesBetType` → `selectionMatchesBetType`。

**有些上限不在這裡檢查**：複式最多幾個號碼、膽拖最多幾注，是設定檔的值（`app.betting.*`），而且膽拖的注數要算組合數，所以放在 `BettingService` 檢查，超過丟 `BusinessException`（`40003`、`40002`）。

**註解可以加在泛型裡面**：`List<@NotNull @BallNumber Integer>` 表示「這個 List 裡的**每一個元素**都要檢查」。這是 Java 的 type-use annotation，class-validator 要用 `@ValidateNested({ each: true })` 才做得到。

### 常用的驗證註解

| 註解 | 意思 | class-validator 對照 |
|---|---|---|
| `@NotNull` | 不能是 null | `@IsDefined()` |
| `@NotBlank` | 字串不能是 null、空字串、只有空白 | `@IsNotEmpty()` + trim |
| `@NotEmpty` | 字串 / List 不能是 null 或空的 | `@IsNotEmpty()` / `@ArrayNotEmpty()` |
| `@Size(min, max)` | 字串長度 / List 大小 | `@Length()` / `@ArrayMinSize()` |
| `@Min` / `@Max` | 數字範圍 | `@Min()` / `@Max()` |
| `@Pattern(regexp)` | 符合正規表達式 | `@Matches()` |
| `@AssertTrue` | 方法回傳 true | 自訂 validator |

### 加上 `@Valid` 才會檢查

```java
// betting/controller/TicketController.java
@PostMapping
public Result<PlaceBetResponse> place(@AuthenticationPrincipal String userId,
                                      @Valid @RequestBody PlaceBetRequest req) {   // ← @Valid
    ...
}
```

**沒有 `@Valid`，DTO 上的註解完全不會執行**。所以 `backend/CLAUDE.md` 規定每個 `@RequestBody` 前面都要有 `@Valid`。

≈ NestJS 全域的 `app.useGlobalPipes(new ValidationPipe())`，只是 Spring 要每個參數自己標。

### 檢查的順序

1. Jackson 把 JSON 轉成 `PlaceBetRequest`（JSON 格式錯誤 → `40000`）
2. 執行 record 的精簡建構子（如果有，例如 `RegisterRequest` 把帳號轉小寫）
3. `@Valid` 觸發所有驗證註解，**全部檢查完**，收集所有錯誤
4. 有錯誤 → 丟 `MethodArgumentNotValidException`，**Controller 方法根本不會執行**
5. `GlobalExceptionHandler` 把它轉成 `40001`

### 實際試試看

送 `{ "drawNo": "", "idempotencyKey": "k1", "lines": [[1, 2, 3, 4, 5, 31], [1, 1, 2, 3, 4, 5]] }`：

```json
{ "code": 40001, "msg": "欄位格式不符",
  "data": [ { "field": "lines[0][5]",     "rule": "ballNumber" },
            { "field": "drawNo",          "rule": "notBlank" },
            { "field": "numbersDistinct", "rule": "assertTrue" } ] }
```

（這是對 8088 實際送出得到的回應。錯誤的**順序不固定**，前端不要依賴順序。）

- `field`：哪個欄位錯，陣列會寫出位置 `lines[0][5]` = 第 1 注第 6 個號碼
- `rule`：哪條規則沒過，就是**註解名稱轉成小寫開頭**（`@NotBlank` → `notBlank`）
- `@AssertTrue` 的方法 `isNumbersDistinct` 會被當成屬性 `numbersDistinct`

## 3. 自訂驗證：`@BallNumber`

### 為什麼不能用 `@Max(30)`

號碼上限是設定 `app.game.max-number`，可能改成 25、35。但**註解的參數必須是寫死的常數**：

```java
@Max(gameProperties.maxNumber())   // ❌ 編譯錯誤：註解參數不能是執行時才知道的值
```

所以自己做一個註解，執行時再去讀設定。

### 註解本身

```java
// betting/validation/BallNumber.java
@Documented
@Target({ElementType.TYPE_USE, ElementType.FIELD, ElementType.PARAMETER})   // ①
@Retention(RetentionPolicy.RUNTIME)                                          // ②
@Constraint(validatedBy = BallNumberValidator.class)                         // ③
public @interface BallNumber {                                               // ④

    String message() default "號碼超出範圍";                                  // ⑤
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}
```

| 編號 | 意思 |
|---|---|
| ① | 這個註解可以加在哪裡。**`TYPE_USE` 才能寫在 `List<@BallNumber Integer>` 裡面** |
| ② | 執行時還看得到這個註解（驗證器是執行時才檢查的，所以一定要 `RUNTIME`） |
| ③ | 真正負責檢查的 class |
| ④ | `@interface` = 宣告一個註解（≈ 寫一個 TS decorator 工廠） |
| ⑤ | `message`、`groups`、`payload` 是 Bean Validation 規定**一定要有**的三個屬性，照抄就好 |

### 驗證器

```java
// betting/validation/BallNumberValidator.java
// Spring 會負責建立這個 class，所以可以注入設定
@RequiredArgsConstructor
public class BallNumberValidator implements ConstraintValidator<BallNumber, Integer> {
    //                                                          ▲ 註解    ▲ 被檢查的值的型別
    private final GameProperties gameProperties;

    @Override
    public boolean isValid(Integer value, ConstraintValidatorContext context) {
        // null 交給 @NotNull 處理，這裡只檢查範圍
        return value == null || (value >= 1 && value <= gameProperties.maxNumber());
    }
}
```

- **不用加 `@Component`**：Spring 建立驗證器時會自動做建構子注入
- **null 回傳 true**：每個註解只管一件事，「不能是 null」是 `@NotNull` 的工作。不然 null 會同時報兩個錯
- `rule` 會是 `ballNumber`（註解名稱 `BallNumber` 轉小寫開頭）

≈ class-validator：

```ts
@ValidatorConstraint()
class BallNumberConstraint implements ValidatorConstraintInterface {
  constructor(private readonly config: GameConfig) {}   // 要搭配 useContainer() 才能注入
  validate(value: number) { return value == null || (value >= 1 && value <= this.config.maxNumber) }
}
```

## 4. 業務錯誤：`BusinessException` + `ErrorCode`

驗證只能檢查「格式」。「積分不夠」「這期已截止」這種要查資料庫才知道的錯誤，在 Service 裡丟出：

```java
// wallet/service/WalletService.java
if (wallet == null) {
    throw new BusinessException(ErrorCode.INSUFFICIENT_POINTS);
}
```

### 錯誤碼總表

```java
// common/ErrorCode.java
@Getter
public enum ErrorCode {
    // 通用（後兩碼 00 = 該 HTTP 狀態的通用錯誤）
    BAD_REQUEST(40000, "請求錯誤"),
    VALIDATION_FAILED(40001, "欄位格式不符"),
    UNAUTHORIZED(40100, "請先登入"),
    FORBIDDEN(40300, "沒有權限"),
    NOT_FOUND(40400, "資源不存在"),
    INTERNAL_ERROR(50000, "系統繁忙，請稍後再試"),
    // 帳戶
    BAD_CREDENTIALS(40101, "帳號或密碼錯誤"),
    SESSION_REPLACED(40102, "帳號已在其他地方登入"),
    USERNAME_TAKEN(40901, "帳號已被使用"),
    // 錢包
    INSUFFICIENT_POINTS(40902, "積分不足"),
    DAILY_BONUS_CLAIMED(40904, "今天已經簽到過了"),
    // 下注
    TOO_MANY_LINES(40002, "注數超過上限"),
    TOO_MANY_NUMBERS(40003, "複式號碼超過上限"),
    BETTING_CLOSED(40903, "這一期已截止下注");

    private final int code;
    private final String message;

    public HttpStatus getStatus() {
        return HttpStatus.valueOf(code / 100);      // 40902 / 100 = 409 → HTTP 409 Conflict
    }
}
```

HTTP 狀態碼直接從錯誤碼算出來，**不會有「錯誤碼是 409 但 HTTP 回 200」這種不一致**。

### 例外本身

```java
// common/BusinessException.java
@Getter
public class BusinessException extends RuntimeException {    // RuntimeException：丟的時候不用到處宣告 throws
    private final ErrorCode errorCode;

    public BusinessException(ErrorCode errorCode) {
        super(errorCode.getMessage());                       // msg 用錯誤碼預設的說明
        this.errorCode = errorCode;
    }

    public BusinessException(ErrorCode errorCode, String message) {
        super(message);                                      // msg 換成更具體的說明
        this.errorCode = errorCode;
    }
}
```

### 新增一個錯誤碼要做的事

1. 在 `ErrorCode` 加一個值，選對 HTTP 狀態和下一個流水號
2. Service 裡 `throw new BusinessException(ErrorCode.NEW_ONE)`
3. 在 `docs/api-changelog.md` 通知前端**加翻譯**（zh-TW、en）

## 5. `GlobalExceptionHandler`：所有錯誤的出口

所有從 Controller（以及 Controller 呼叫的 Service）丟出來的例外，最後都會到這裡：

```java
// common/GlobalExceptionHandler.java
@Slf4j
@RestControllerAdvice                     // ① 套用在所有 Controller
public class GlobalExceptionHandler {

    @ExceptionHandler(BusinessException.class)            // ② 業務錯誤
    public ResponseEntity<Result<Void>> handleBusiness(BusinessException ex) {
        ErrorCode ec = ex.getErrorCode();
        log.warn("業務錯誤 {}: {}", ec.getCode(), ex.getMessage());
        return ResponseEntity.status(ec.getStatus())                 // HTTP 狀態 = code / 100
                .body(Result.fail(ec.getCode(), ex.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)    // ③ @Valid 驗證失敗
    public ResponseEntity<Result<List<FieldViolation>>> handleValidation(MethodArgumentNotValidException ex) {
        List<FieldViolation> violations = ex.getBindingResult().getFieldErrors().stream()
                .map(e -> new FieldViolation(e.getField(), toRule(e.getCode())))   // "BallNumber" → "ballNumber"
                .toList();
        ErrorCode ec = ErrorCode.VALIDATION_FAILED;
        return ResponseEntity.status(ec.getStatus())
                .body(Result.fail(ec.getCode(), ec.getMessage(), violations));
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)  // ④ ?page=abc、?period=YEAR
    public ResponseEntity<Result<List<FieldViolation>>> handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        List<FieldViolation> violations = List.of(new FieldViolation(ex.getName(), "typeMismatch"));
        ...
    }

    // body 不是合法的 JSON、型別對不上（例如 betType 不是已知的玩法）
    @ExceptionHandler(HttpMessageNotReadableException.class)    // ⑤ 請求內容無法解析
    public ResponseEntity<Result<Void>> handleUnreadable(HttpMessageNotReadableException ex) {
        log.warn("請求內容無法解析: {}", ex.getMessage());
        ErrorCode ec = ErrorCode.BAD_REQUEST;
        return ResponseEntity.status(ec.getStatus())
                .body(Result.fail(ec.getCode(), ec.getMessage()));
    }

    @ExceptionHandler(Exception.class)                    // ⑥ 其他所有沒預期的錯誤
    public ResponseEntity<Result<Void>> handleOther(Exception ex) {
        if (ex instanceof ErrorResponse er) {             // Spring 自己的 HTTP 錯誤（404、405…）
            int status = er.getStatusCode().value();
            String detail = er.getBody().getDetail();
            return ResponseEntity.status(status)
                    .body(Result.fail(status * 100, detail != null ? detail : "請求錯誤"));   // 404 → 40400
        }
        log.error("未預期的錯誤", ex);                    // 真的是 bug：印出完整錯誤，方便查
        ErrorCode ec = ErrorCode.INTERNAL_ERROR;
        return ResponseEntity.status(ec.getStatus())
                .body(Result.fail(ec.getCode(), ec.getMessage()));   // 不把錯誤細節給前端
    }

    private static String toRule(String constraint) {
        return Character.toLowerCase(constraint.charAt(0)) + constraint.substring(1);
    }
}
```

| 編號 | 接住什麼 | 回應 |
|---|---|---|
| ① | `@RestControllerAdvice`：讓這個 class 的處理方法套用到所有 Controller | — |
| ② | Service 主動丟的 `BusinessException` | 對應的錯誤碼 |
| ③ | `@Valid` 驗證失敗 | `40001` + `[{ field, rule }]` |
| ④ | 網址參數轉型失敗 | `40001` + `rule: "typeMismatch"` |
| ⑤ | body 不是合法的 JSON、enum 值不存在（`"betType": "XYZ"`） | `40000` |
| ⑥ | Spring 自己的 HTTP 錯誤 | 狀態碼 × 100（`40400`、`40500`…） |
| ⑥ | **其他所有例外**（`NullPointerException` 之類的 bug） | `50000`，細節只印在後端日誌 |

Spring 怎麼選處理方法：找**最具體**的那個。`BusinessException` 有自己的處理方法，所以不會掉到 ⑥ 的 `Exception`。

> ⑤ 是加了複式、膽拖之後補的：`betType` 是 enum，前端送一個不存在的值時，Jackson 會丟 `HttpMessageNotReadableException`。它不是 `ErrorResponse`，原本會掉到 ⑥ 回 `50000`，看起來像後端壞掉，其實是請求有問題。**用 `50000` 回應使用者的錯誤，就是錯誤處理有漏洞**。

≈ NestJS 的全域 Exception Filter：`@Catch(HttpException)`、`@Catch()`。

> ⚠️ **為什麼 ⑤ 不把錯誤訊息回給前端？** `NullPointerException` 的訊息可能包含程式內部細節（class 名稱、資料庫欄位），給外人看有安全疑慮。前端只需要知道「系統出錯了」，詳細原因看後端日誌。

### 登入相關的錯誤也走這裡

Spring Security 的錯誤（沒登入、被踢掉）發生在 Controller **之前**，正常來說不會經過 `GlobalExceptionHandler`。`SecurityConfig` 特別把它們轉進來，所以格式也一樣是 `{ code, msg, data }`（第 7 章）。

## 6. 錯誤的一生：積分不足

1. 前端 `POST /api/tickets`，花費 500，但餘額只有 100
2. `TicketController.place` → `BettingService.place` → `walletService.debit(userId, 500, ...)`
3. `debit` 用「`balance >= 500` 才扣」的條件更新，找不到符合的錢包，回傳 `null`
4. `throw new BusinessException(ErrorCode.INSUFFICIENT_POINTS)`
5. 例外往外傳，經過交易時**交易回滾**（剛建好的注單也一起取消，第 9 章）
6. 到了 `GlobalExceptionHandler.handleBusiness`
7. 回應 HTTP 409：`{ "code": 40902, "msg": "積分不足", "data": null }`
8. 前端看到 `40902`，顯示翻譯好的「積分不足」

## 7. Swagger 註解

API 文件也是寫在程式碼上的：

| 註解 | 加在 | 作用 |
|---|---|---|
| `@Tag(name, description)` | Controller class | 分組 |
| `@Operation(summary)` | Controller 方法 | 這支 API 的說明 |
| `@Schema(description, example, requiredMode)` | DTO 欄位 | 欄位說明、範例、是否必填 |

`requiredMode = REQUIRED` 很重要：前端用 `npm run gen:api` 從 `openapi.json` 產生 TypeScript 型別，沒標 REQUIRED 的欄位會變成 `field?: type`，前端每次都要處理 `undefined`。

---

## 小練習

1. 在 Swagger 送一個 `lines` 是 `[[1, 2, 3]]` 的下注，看 `field` 和 `rule` 是什麼。
2. 送 `{ "username": "ab", "nickname": "x", "password": "123" }` 到 `POST /api/auth/register`，會有幾個錯誤？各是什麼 rule？（看 `RegisterRequest` 的註解來猜，再實際送送看）
3. 打一個不存在的網址 `GET /api/nothing`（登入後），回應是什麼？是 `GlobalExceptionHandler` 的哪個方法處理的？
   <details><summary>答案</summary><code>{"code":40400,"msg":"No static resource api/nothing.","data":null}</code>。Spring 找不到對應的 Controller，就當成靜態檔案去找，也找不到，丟出 <code>NoResourceFoundException</code>，它實作了 <code>ErrorResponse</code>，所以由 <code>handleOther</code> 的第一段處理（404 × 100）。以後看到 "No static resource"，通常是 Controller 的路徑打錯或方法漏寫。</details>
4. 如果要加一個錯誤「單注號碼全部一樣」，你會給它什麼 code？為什麼？
   <details><summary>參考</summary>這其實是格式問題，已經被 numbersDistinct 擋了。如果真的要新的業務錯誤，400 類用 40003（40000~40002 已被使用），409 類用 40905。</details>

上一章：[05 第一支 API](05-first-api.md)　下一章：[07 登入](07-security-login.md)
