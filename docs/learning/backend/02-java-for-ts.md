# 02 Java 語法（給 TypeScript 工程師）

這一章只講**這個專案裡真的用到的語法**。每個語法都附上專案裡的例子，以及 TypeScript 的寫法。

讀法建議：先快速看過一遍，之後讀其他章節遇到看不懂的語法再回來查。

---

## 1. 檔案、package、import

```java
package com.thirtylab.wallet.service;          // ① 這個檔案屬於哪個 package

import com.thirtylab.common.BusinessException;  // ② 用到別的 package 的 class 要 import
import com.thirtylab.wallet.model.Wallet;
import java.util.List;

public class WalletService { ... }              // ③ 一個檔案一個 public class，名稱要跟檔名一樣
```

| Java | TypeScript | 說明 |
|---|---|---|
| `package com.thirtylab.wallet.service;` | （沒有，靠資料夾路徑） | **必須**和資料夾路徑一致：`src/main/java/com/thirtylab/wallet/service/` |
| `import com.thirtylab.wallet.model.Wallet;` | `import { Wallet } from '../model/Wallet'` | Java 寫完整名稱，不寫相對路徑 |
| `import java.util.*;` | `import * as util from ...` | 匯入整個 package 的 class（專案裡少用） |
| 同一個 package 的 class | — | **不用 import** 就能直接用 |

**`java.lang` 的東西不用 import**：`String`、`Integer`、`Math`、`Thread` 這些隨時可以用。

> ⚠️ IntelliJ 自動 import 時，常常有好幾個同名的 class 可以選（例如 `Update` 有 Mongo 的、也有別的）。**看清楚套件名稱**，Mongo 相關的要選 `org.springframework.data.mongodb...`。

---

## 2. 型別

### 基本型別 vs 包裝型別

這是 Java 跟 TypeScript 最不一樣、也最容易出錯的地方。

| Java 基本型別（小寫） | 包裝型別（大寫） | TypeScript | 差別 |
|---|---|---|---|
| `int`（32 位整數） | `Integer` | `number` | `int` **不能是 null**，沒給值時是 `0` |
| `long`（64 位整數） | `Long` | `number` | 同上；**積分一律用 `long`** |
| `double`（小數） | `Double` | `number` | 有誤差，**錢不能用** |
| `boolean` | `Boolean` | `boolean` | `boolean` 沒給值時是 `false` |

**什麼時候用哪個？** 看「可不可以沒有值」：

```java
// draw/model/Draw.java
private List<Integer> numbers;      // List 裡面只能放包裝型別，不能寫 List<int>
private Integer specialNumber;      // 還沒開獎時沒有特別號碼 → 要能是 null → 用 Integer
private Long poolAmount;            // 還沒結算時沒有彩池金額 → 用 Long

// wallet/model/Wallet.java
private long balance;               // 錢包一定有餘額 → 用 long，預設 0
```

TypeScript 對照：`specialNumber: number | null` 用 `Integer`；`balance: number` 用 `long`。

> ⚠️ **基本型別的預設值會偷偷變成 0**。設定檔漏寫 `app.prize.jackpot-rate-percent`，`long jackpotRatePercent` 不會報錯，而是變成 0，結果彩池完全不會增加（這個專案真的發生過，見第 4 章）。

### 數字的小陷阱

```java
long contribution = turnover * prizeProperties.jackpotRatePercent() / 100;   // settlement/service/PrizeCalculator.java
```

- **整數除法會直接捨去小數**：`30 / 100` 是 `0`，不是 `0.3`。所以一定要**先乘再除**：`30 * 20 / 100 = 6`
- `long` 超過上限會**默默變成錯的數字**，不會報錯（所以組合數 C(30,6) 是用逐步乘除算，不是先算階乘）
- 數字可以加底線方便閱讀：`1_000_000`
- `long` 的字面值要加 `L`：`9_600L`（在需要 `Long` 物件的地方，`9_600` 會被當成 `int` 而編譯失敗）

### 字串

```java
"20261023-" + String.format("%04d", index)   // draw/service/DrawSchedule.java → "20261023-0042"
"session:" + userId                          // account/service/SessionService.java
"錢包不存在: " + userId
```

| Java | TypeScript |
|---|---|
| `"a" + b` | `` `a${b}` `` |
| `"第 %d 期".formatted(n)` / `String.format("第 %d 期", n)` | `` `第 ${n} 期` `` |
| `"""` 多行文字 `"""` | `` `多行` `` |
| `s.equals(t)` | `s === t` |
| `s.strip()` | `s.trim()` |
| `s.toLowerCase(Locale.ROOT)` | `s.toLowerCase()` |

> ⚠️ **比較字串、物件一律用 `.equals()`，不要用 `==`**。`==` 比的是「是不是同一個物件」，兩個內容一樣的字串可能是不同物件，`==` 會得到 `false`。數字（`int`、`long`）和 enum 可以用 `==`。

```java
if (!current.equals(claims.getId())) { ... }   // account/security/JwtCookieFilter.java
if (ticket.getStatus() != TicketStatus.PENDING) { ... }   // enum 可以用 == / !=
```

### `var`：讓編譯器推斷型別

```java
var existing = ticketRepository.findByUserIdAndIdempotencyKey(userId, req.idempotencyKey());
// existing 的型別是 Optional<Ticket>，編譯器自己知道
```

≈ TypeScript 的 `const existing = ...`。只能用在方法裡的區域變數。型別還是固定的，不是 `any`。

---

## 3. class、欄位、建構子、方法

### 一個完整的 class（不用 Lombok 的寫法）

先看 `JwtService`，它沒有用 Lombok，所以每一行都是自己寫的：

```java
@Service
public class JwtService {

    private final SecretKey key;          // ① 欄位：private = 只有這個 class 能用；final = 設定一次之後不能改
    private final Duration ttl;

    public JwtService(AuthProperties props) {     // ② 建構子：名稱跟 class 一樣，沒有回傳型別
        this.key = Keys.hmacShaKeyFor(props.jwtSecret().getBytes(StandardCharsets.UTF_8));
        this.ttl = props.tokenTtl();
    }

    public String issue(String userId, String sessionId) {   // ③ 方法：回傳型別寫在前面
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(userId)
                ...
                .compact();
    }
}
```

TypeScript 對照：

```ts
@Injectable()
export class JwtService {
  private readonly key: SecretKey
  private readonly ttl: Duration

  constructor(props: AuthProperties) {
    this.key = hmacShaKeyFor(...)
    this.ttl = props.tokenTtl
  }

  issue(userId: string, sessionId: string): string { ... }
}
```

| Java | TypeScript |
|---|---|
| `String issue(String userId)` | `issue(userId: string): string` |
| `void logout(String userId)` | `logout(userId: string): void` |
| `private final` | `private readonly` |
| `this.key = ...` | `this.key = ...` |

### 存取範圍

| Java | 誰看得到 | TypeScript 對照 |
|---|---|---|
| `public` | 所有人 | `public`（預設） |
| `private` | 只有這個 class | `private` |
| **什麼都不寫** | **同一個 package 的 class** | 沒有對應的概念 |
| `protected` | 同 package + 子類別 | `protected` |

「什麼都不寫」（package-private）在這個專案用來讓**測試**可以呼叫：測試放在同名的 package（`src/test/java/com/thirtylab/rules/service/`），所以 `GameRulesService` 裡沒加 `public` 的 `winningCombinations` 方法，測試可以直接測，其他模組卻用不到。

### `static`：屬於 class，不屬於某個物件

```java
// wallet/service/DailyBonusService.java
private static LocalDate today(Instant now) {
    return LocalDate.ofInstant(now, ZoneOffset.UTC);
}
```

- 不需要讀任何欄位的方法，可以加 `static`，≈ 寫在 class 外面的普通函式
- `static` 方法**不能用 `this`**，所以讀不到注入的欄位（例如 `gameProperties`）。要讀設定的方法就不能是 `static`
- `static final` 的欄位 = 常數：`private static final int MAX_ATTEMPTS = 3;` ≈ `const MAX_ATTEMPTS = 3`

### 工具類別

```java
// common/Pagination.java
public final class Pagination {            // final class：不能被繼承
    public static final int MAX_SIZE = 100;
    private Pagination() {}                // private 建構子：不能 new，只能用 Pagination.of(...)
    public static Pageable of(int page, int size, Sort sort) { ... }
}
```

≈ 一個只 export 函式的 TS 檔案。

---

## 4. Lombok：幫你寫樣板程式碼

Java 的 class 需要大量 getter、setter、建構子。Lombok 讓你用一個註解代替它們。**編譯時**它會真的把這些方法產生出來，你在 IntelliJ 的 Structure 視窗（`Alt + 7`）看得到。

### `@Getter @Setter @NoArgsConstructor`：資料庫的 model

```java
// wallet/model/Wallet.java（你寫的）
@Getter
@Setter
@NoArgsConstructor
@Document("wallets")
public class Wallet {
    @Id
    private String id;
    @Indexed(unique = true)
    private String userId;
    private long balance;
    ...
}
```

Lombok 實際產生的（你看不到，但它存在）：

```java
public Wallet() {}                                    // @NoArgsConstructor：沒有參數的建構子
public String getId() { return id; }                  // @Getter
public void setId(String id) { this.id = id; }        // @Setter
public String getUserId() { return userId; }
public void setUserId(String userId) { this.userId = userId; }
public long getBalance() { return balance; }
public void setBalance(long balance) { this.balance = balance; }
...
```

所以其他地方可以寫 `wallet.getBalance()`、`ticket.setStatus(TicketStatus.PENDING)`。

> 為什麼 model 要「沒有參數的建構子 + setter」？因為 Spring Data 從 MongoDB 讀資料時，要先 `new Wallet()`，再把欄位一個一個塞進去。

### `@RequiredArgsConstructor`：依賴注入

```java
// wallet/service/WalletService.java（你寫的）
@Service
@RequiredArgsConstructor
public class WalletService {
    private final WalletRepository walletRepository;
    private final WalletTransactionRepository transactionRepository;
    private final MongoTemplate mongoTemplate;
    private final WalletProperties walletProperties;
    ...
}
```

Lombok 產生的建構子：**所有 `final` 欄位都變成參數**：

```java
public WalletService(WalletRepository walletRepository,
                     WalletTransactionRepository transactionRepository,
                     MongoTemplate mongoTemplate,
                     WalletProperties walletProperties) {
    this.walletRepository = walletRepository;
    this.transactionRepository = transactionRepository;
    this.mongoTemplate = mongoTemplate;
    this.walletProperties = walletProperties;
}
```

Spring 看到這個建構子，就知道要注入哪些東西（第 3 章）。**這就是為什麼每個 Service 的欄位都寫 `private final`**：少了 `final`，Lombok 不會把它放進建構子，那個欄位就會是 `null`。

### 其他 Lombok

| 註解 | 產生什麼 | 專案例子 |
|---|---|---|
| `@Getter`（加在 class 上） | 所有欄位的 getter | `ErrorCode`、`BusinessException` |
| `@Slf4j` | `private static final Logger log = ...` | `DrawTicker` 裡的 `log.info(...)` |

---

## 5. record：不可變的資料

專案裡的 **DTO 全部是 record**。

```java
// betting/model/LineResult.java
public record LineResult(int matched, boolean specialHit, PrizeTier tier, long prize) { }
```

這一行等於寫了：

- 4 個 `private final` 欄位
- 一個依**宣告順序**接收 4 個參數的建構子：`new LineResult(5, true, PrizeTier.SECOND, 56000)`
- 4 個讀取方法：`result.matched()`、`result.tier()`（**沒有 `get` 前綴**，這點跟 Lombok 的 `getXxx()` 不一樣）
- `equals`：**所有欄位都一樣就相等**，所以測試可以寫 `assertThat(result).isEqualTo(new LineResult(...))`
- `toString`：印出 `LineResult[matched=5, specialHit=true, tier=SECOND, prize=56000]`

TypeScript 對照：`type LineResult = Readonly<{ matched: number; specialHit: boolean; tier: PrizeTier | null; prize: number }>`，但 record 是一個真的 class。

### 怎麼分辨該用 record 還是一般 class

| 用 record | 用一般 class + Lombok |
|---|---|
| 建立之後不會改：DTO、計算結果、設定 | 會被修改：資料庫的 model（`Wallet`、`Ticket`） |
| `response.balance()` | `wallet.getBalance()` / `wallet.setBalance(...)` |

### 泛型 record：`Result<T>`

```java
// common/Result.java
public record Result<T>(int code, String msg, T data) {

    public static <T> Result<T> ok(T data) {
        return new Result<>(0, "ok", data);
    }

    public static <T> Result<T> fail(int code, String msg) {
        return new Result<>(code, msg, null);
    }
}
```

- `<T>` ≈ TypeScript 的泛型 `type Result<T> = { code: number; msg: string; data: T }`
- `Result<WalletResponse>`：`data` 是 `WalletResponse`
- `Result<Void>`：沒有資料（`Void` 是「沒有東西」的型別，`data` 永遠是 `null`）
- `new Result<>(...)`：`<>` 讓編譯器自己推斷 `T`
- `static <T> Result<T> ok(T data)`：前面的 `<T>` 宣告「這個方法有一個型別參數」，≈ `function ok<T>(data: T): Result<T>`

### 精簡建構子：建立時順便整理資料

```java
// account/dto/RegisterRequest.java
public record RegisterRequest(String username, String nickname, String password) {

    public RegisterRequest {                       // 沒有參數列 = 精簡建構子
        if (username != null) {
            username = username.strip().toLowerCase(Locale.ROOT);   // 去掉空白、轉小寫
        }
        if (nickname != null) {
            nickname = nickname.strip();
        }
    }
}
```

Jackson 把 JSON 轉成 `RegisterRequest` 時會呼叫這個建構子，所以 `" Rain_01 "` 進來就變成 `"rain_01"`，後面的程式完全不用再處理大小寫。

---

## 6. enum：可以帶資料、帶方法的列舉

TypeScript 的 enum 只是一組常數；Java 的 enum 每個值都是一個物件，可以有欄位和方法。

```java
// betting/model/PrizeTier.java
public enum PrizeTier {
    FIRST(6, false),        // 每個值後面括號裡的，就是傳給建構子的參數
    SECOND(5, true),
    THIRD(5, false),
    FOURTH(4, true),
    FIFTH(4, false),
    SIXTH(3, true),
    SEVENTH(3, false);      // 最後一個值後面是分號

    private final int matched;
    private final boolean specialHit;

    PrizeTier(int matched, boolean specialHit) {   // enum 的建構子
        this.matched = matched;
        this.specialHit = specialHit;
    }

    public int matched() { return matched; }

    public static PrizeTier of(int matched, boolean specialHit) {
        return switch (matched) {
            case 6 -> FIRST;
            case 5 -> specialHit ? SECOND : THIRD;
            case 4 -> specialHit ? FOURTH : FIFTH;
            case 3 -> specialHit ? SIXTH : SEVENTH;
            default -> null;            // 中 2 個以下：沒有獎
        };
    }
}
```

使用：

```java
PrizeTier.of(5, true)          // SECOND
PrizeTier.SECOND.matched()     // 5
PrizeTier.values()             // 全部 7 個，依宣告順序 ≈ Object.values(PrizeTier)
```

- **宣告順序有意義**：`FIRST` 最小。`tiers.stream().min(Comparator.naturalOrder())` 會拿到「最高的獎級」（`betting/service/BettingService.java` 的 `toRecentWin`）
- 存進 MongoDB 時是字串 `"SECOND"`；JSON 也是字串
- `ErrorCode` 也是 enum：`USERNAME_TAKEN(40901, "帳號已被使用")`

### switch 運算式

```java
return switch (tier) {
    case FIRST -> jackpotShare;
    case SECOND -> prizeProperties.second();
    ...
    case SEVENTH -> prizeProperties.seventh();
};
```

- `->` 寫法：每個 case 直接回傳值，**不用 `break`**
- 對 enum 做 switch 時，**少寫任何一個值都會編譯失敗**（≈ TypeScript 用 `never` 做窮舉檢查），以後加了新獎級，編譯器會告訴你哪裡忘了處理

---

## 7. 例外（Exception）

### 丟出、接住

```java
throw new BusinessException(ErrorCode.INSUFFICIENT_POINTS);    // ≈ throw new HttpException(...)

try {
    saved = userRepository.save(user);
} catch (DuplicateKeyException e) {                            // 只接住這一種錯誤
    throw new BusinessException(ErrorCode.USERNAME_TAKEN);    // 轉成業務錯誤再丟出去
}
```

`catch (DuplicateKeyException e)` 只會接住這種錯誤，其他的錯誤會繼續往外丟。TypeScript 的 `catch (e)` 接住一切，要自己用 `instanceof` 判斷；Java 是在 `catch` 的括號裡就寫好型別。

### 例外有繼承關係

```
RuntimeException
 └─ DataAccessException
     └─ DataIntegrityViolationException      ← WriteConflict 被包成這個
         └─ DuplicateKeyException            ← 撞到唯一索引
```

`catch (DataIntegrityViolationException e)` 也會接住 `DuplicateKeyException`（子類別）。**同時要接兩種時，子類別要寫在前面**，不然子類別那個 catch 永遠輪不到。

### 兩種例外

| 種類 | 繼承自 | 要不要宣告 | 專案例子 |
|---|---|---|---|
| unchecked（大部分） | `RuntimeException` | 不用 | `BusinessException`、`DuplicateKeyException` |
| checked | `Exception` | **一定要** `try/catch` 或在方法寫 `throws` | `Thread.sleep` 的 `InterruptedException` |

```java
// betting/service/BettingService.java
private static void pause(int attempt) {
    try {
        Thread.sleep(50L * attempt);              // sleep 可能丟 InterruptedException（checked）
    } catch (InterruptedException e) {            // 所以編譯器強迫你處理
        Thread.currentThread().interrupt();
    }
}
```

我們自己的 `BusinessException extends RuntimeException`，所以丟的時候不用到處宣告。

---

## 8. Lambda、方法參考、Stream

### Lambda ≈ 箭頭函式

| Java | TypeScript |
|---|---|
| `x -> x * 2` | `x => x * 2` |
| `(a, b) -> a + b` | `(a, b) => a + b` |
| `() -> open(userId)` | `() => open(userId)` |
| `x -> { ...; return y; }` | `x => { ...; return y }` |

### 方法參考：更短的 lambda

| 方法參考 | 等於 | 意思 |
|---|---|---|
| `Ticket::getCost` | `t -> t.getCost()` | 呼叫每個元素的 `getCost()` |
| `WalletTransactionResponse::from` | `tx -> WalletTransactionResponse.from(tx)` | 把每個元素傳給靜態方法 |
| `numbers::contains` | `n -> numbers.contains(n)` | 呼叫某個物件的方法 |
| `Integer::sum` | `(a, b) -> Integer.sum(a, b)` | |

### Stream ≈ 陣列方法鏈

Java 的 `List` 沒有 `.map()`，要先 `.stream()` 轉成 Stream，處理完再 `.toList()` 轉回來。

```java
// settlement/service/PrizeCalculator.java：這一注中了幾個號碼
int matched = (int) line.stream().filter(numbers::contains).count();
// TS: const matched = line.filter(n => numbers.includes(n)).length
```

```java
// settlement/service/SettlementService.java：這期的投注總額
tickets.stream().mapToLong(Ticket::getCost).sum();
// TS: tickets.reduce((sum, t) => sum + t.cost, 0)
```

```java
// settlement/service/SettlementService.java：這期有幾注中頭獎
int jackpotLines = (int) tickets.stream()
        .flatMap(ticket -> ticket.getLines().stream())   // 每張注單有好幾注，攤平成一個一個注
        .filter(line -> isJackpot(line, draw))
        .count();
// TS: tickets.flatMap(t => t.lines).filter(line => isJackpot(line, draw)).length
```

| JavaScript | Java Stream |
|---|---|
| `arr.map(f)` | `list.stream().map(f).toList()` |
| `arr.filter(f)` | `.filter(f)` |
| `arr.find(f) ?? null` | `.filter(f).findFirst().orElse(null)` |
| `arr.slice(0, 20)` | `.limit(20)` |
| `arr.length` | `.count()`（回傳 `long`） |
| `arr.some(f)` | `.anyMatch(f)` |
| `arr.flatMap(f)` | `.flatMap(x -> x.list().stream())` |
| `arr.reduce((s, x) => s + x.cost, 0)` | `.mapToLong(X::getCost).sum()` |
| `Object.fromEntries(arr.map(x => [x.id, x.name]))` | `.collect(Collectors.toMap(User::getId, User::getNickname))` |
| `[...arr].sort((a, b) => a - b)` | `.sorted()` |
| `Array.from({ length: 30 }, (_, i) => i + 1)` | `IntStream.rangeClosed(1, 30)` |

---

## 9. Optional：可能沒有值

Repository 查一筆資料時，常回傳 `Optional<T>`，提醒你「可能找不到」。

```java
// wallet/service/WalletService.java
public Wallet getOrOpen(String userId) {
    return walletRepository.findByUserId(userId)       // Optional<Wallet>
            .orElseGet(() -> open(userId));            // 找不到就開戶
}
```

```java
// account/service/AuthService.java
User user = userRepository.findUserByUsername(req.username())         // Optional<User>
        .filter(u -> passwordEncoder.matches(req.password(), u.getPasswordHash()))   // 密碼不對 → 變成空的
        .orElseThrow(() -> new BusinessException(ErrorCode.BAD_CREDENTIALS));      // 空的 → 丟錯
```

| Optional | TypeScript |
|---|---|
| `opt.orElse(x)` | `value ?? x` |
| `opt.orElseGet(() -> f())` | `value ?? f()`（只有空的時候才呼叫 `f`） |
| `opt.orElseThrow(() -> err)` | `if (!value) throw err` |
| `opt.map(f)` | `value ? f(value) : null` |
| `opt.isPresent()` | `value != null` |

> 帳號不存在、密碼錯誤都回同一個錯誤 `40101`，不讓別人試出哪些帳號存在。

---

## 10. 其他會看到的語法

### instanceof 模式比對 ≈ 型別守衛

```java
// config/SecurityConfig.java
return request.getAttribute(JwtCookieFilter.AUTH_ERROR_ATTR) instanceof ErrorCode code
        ? code
        : ErrorCode.UNAUTHORIZED;
```

「如果這個值是 `ErrorCode`，就把它叫做 `code` 拿來用」。≈ TS：`const v = ...; return v instanceof ErrorCode ? v : ErrorCode.UNAUTHORIZED`。

### 三元運算子、for 迴圈

```java
long share = jackpotLines == 0 ? 0 : pool / jackpotLines;     // 跟 TS 一樣

for (Ticket ticket : tickets) { ... }                          // ≈ for (const ticket of tickets)
for (int attempt = 1; ; attempt++) { ... }                     // 沒有結束條件 = 無限迴圈，靠 return / throw 離開
```

### 巢狀 record

```java
// account/service/SessionService.java
public record NewSession(String sessionId, String replacedSessionId) {}
```

寫在 class 裡面的 record，外面用 `SessionService.NewSession` 稱呼。適合「只有這個 class 會用到」的小型資料。

### 時間

| Java | 意思 | TypeScript |
|---|---|---|
| `Instant` | 一個 UTC 時間點 | `Date` |
| `Instant.now().truncatedTo(ChronoUnit.MILLIS)` | 現在，截到毫秒（MongoDB 只存到毫秒） | `new Date()` |
| `Duration.ofMinutes(5)` | 一段時間長度 | `5 * 60 * 1000` |
| `LocalDate` | 只有日期（沒有時間、沒有時區） | `'2026-10-23'` |
| `LocalDate.ofInstant(now, ZoneOffset.UTC)` | 這個時間點在 UTC 是哪一天 | |

---

## 小練習

1. 在 IntelliJ 打開 `Ticket.java`，`Alt + 7` 打開 Structure，找出 Lombok 產生的 `getCost()` 和 `setStatus()`。
2. `PrizeTier.of(4, false)` 回傳什麼？`PrizeTier.of(2, true)` 呢？
3. `Draw` 的 `specialNumber` 為什麼是 `Integer` 而不是 `int`？如果改成 `int`，還沒開獎的期數讀出來會是多少？
4. 把下面的 TypeScript 翻成 Java Stream：`tickets.filter(t => t.status === 'WON').map(t => t.userId)`
5. `RecentWin`、`Wallet` 哪一個是 record？從哪裡看出來？讀取欄位的寫法有什麼不同？

<details>
<summary>第 4 題答案</summary>

```java
tickets.stream()
        .filter(t -> t.getStatus() == TicketStatus.WON)
        .map(Ticket::getUserId)
        .toList();
```
</details>

上一章：[01 全貌](01-big-picture.md)　下一章：[03 Spring 核心](03-spring-bean-di.md)
