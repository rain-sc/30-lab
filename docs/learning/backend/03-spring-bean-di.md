# 03 Spring 核心：Bean 與依賴注入

## 1. 要解決什麼問題

`BettingService` 下注時要用到 5 個東西：

```java
private final TicketRepository ticketRepository;     // 存注單
private final DrawService drawService;               // 檢查期數有沒有開放
private final WalletService walletService;           // 扣積分
private final TransactionTemplate transactionTemplate;   // 開交易
private final BettingProperties bettingProperties;   // 一張注單最多幾注
...
```

如果自己 `new`，會變成這樣：

```java
// ❌ 沒有 Spring 的世界
var mongoClient = MongoClients.create("mongodb://localhost:27018/...");
var mongoTemplate = new MongoTemplate(mongoClient, "thirtylab");
var walletRepository = ...;           // Repository 是 interface，你甚至不知道怎麼 new
var walletService = new WalletService(walletRepository, transactionRepository, mongoTemplate, walletProperties);
var drawService = new DrawService(drawRepository, mongoTemplate, drawSchedule, numberGenerator);
var bettingService = new BettingService(ticketRepository, drawService, walletService, ...);
// ……每個 class 都要這樣接，而且整個程式只能有一份 walletService，不能每次都 new
```

問題：

1. 要自己算出「誰先建、誰後建」
2. 每個用到 `WalletService` 的地方，都要想辦法拿到**同一個**實例
3. 測試時想換成假的資料庫，要改一堆地方

**Spring 的做法**：你只要說「我需要什麼」，**誰來建、什麼順序、給誰**都由 Spring 負責。這就叫**依賴注入（Dependency Injection, DI）**，負責建立和保管物件的那個東西叫 **IoC 容器**，裡面的每個物件叫 **Bean**。

NestJS 也是同一套思想，你其實已經用過了。

## 2. 跟 NestJS 對照

```ts
// NestJS
@Injectable()
export class WalletService {
  constructor(
    private readonly walletRepository: WalletRepository,
    private readonly config: ConfigService,
  ) {}
}

@Module({
  providers: [WalletService, DailyBonusService],   // ← 要手動列出來
  controllers: [WalletController],
  exports: [WalletService],
})
export class WalletModule {}
```

```java
// Spring
@Service
@RequiredArgsConstructor
public class WalletService {
    private final WalletRepository walletRepository;
    private final WalletProperties walletProperties;
}
// 沒有 @Module！
```

| | NestJS | Spring |
|---|---|---|
| 標記「這個 class 交給框架管理」 | `@Injectable()` | `@Service` / `@Component` / `@RestController` / `@Configuration` |
| 宣告需要什麼 | constructor 參數 | constructor 參數（用 Lombok `@RequiredArgsConstructor` 產生） |
| 註冊到哪裡 | **手動**列在 `@Module` 的 `providers` | **自動掃描** `com.thirtylab` 底下所有 package |
| 預設幾個實例 | 單例 | 單例 |

**最大的差別：Spring 沒有 `@Module`**。只要 class 放在 `com.thirtylab` 底下、加了 `@Service`，啟動時就會被找到並建立。少寫很多樣板，但也代表**模組邊界不會被框架強制**，`stats` 想直接用 `WalletRepository` 也沒人擋你，要靠自己守規矩（見第 8 章最後、[project-workflow.md 第 2 節](../project-workflow.md#3-後端模組與依賴)）。

## 3. 讓 class 變成 Bean 的註解

| 註解 | 用在 | 專案例子 |
|---|---|---|
| `@Service` | 業務邏輯 | `WalletService`、`BettingService` |
| `@Component` | 其他一般的元件 | `DrawTicker`、`PrizeCalculator`、`DrawSchedule`、`NumberGenerator` |
| `@RestController` | 接 HTTP 請求 | `WalletController` |
| `@Configuration` | 設定類別，裡面用 `@Bean` 方法建立物件 | `SecurityConfig`、`PasswordConfig` |
| （不用註解）`extends MongoRepository` 的 interface | 資料庫存取 | `WalletRepository` |
| `@ConfigurationProperties` | 設定值 | `GameProperties`（第 4 章） |

`@Service` 和 `@Component` 功能完全一樣，只是名字不同，讓人一看就知道這個 class 的角色。

### Repository 為什麼只寫 interface 就能用？

```java
public interface WalletRepository extends MongoRepository<Wallet, String> {
    Optional<Wallet> findByUserId(String userId);
}
```

你沒寫任何實作，Spring Data 啟動時會**自動產生一個實作這個 interface 的 class**，並建立 Bean。`findByUserId` 的查詢是從**方法名稱**推出來的（第 8 章）。

### `@Configuration` + `@Bean`：建立「不是你寫的 class」

`BCryptPasswordEncoder` 是 Spring Security 的 class，你不能在它身上加 `@Component`。這時用 `@Bean` 方法：

```java
// config/PasswordConfig.java
@Configuration
public class PasswordConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
```

Spring 會呼叫這個方法一次，把回傳的物件存成 Bean。之後任何 class 在建構子宣告 `PasswordEncoder passwordEncoder`，拿到的就是它（`AuthService` 就是這樣拿到的）。

≈ NestJS 的 `{ provide: PasswordEncoder, useFactory: () => new BCryptPasswordEncoder() }`。

## 4. 注入是怎麼發生的：一步一步看

以 `DailyBonusService` 為例：

```java
@Service
@RequiredArgsConstructor
public class DailyBonusService {
    private final WalletService walletService;
    private final WalletTransactionRepository transactionRepository;
    private final WalletProperties walletProperties;
}
```

1. 啟動時，Spring 掃描到 `DailyBonusService` 有 `@Service`，記下來「要建立它」
2. Lombok 已經產生了建構子 `DailyBonusService(WalletService, WalletTransactionRepository, WalletProperties)`
3. Spring 看建構子的參數型別，發現要先有 `WalletService`、`WalletTransactionRepository`、`WalletProperties`
4. `WalletService` 又需要 `WalletRepository`、`MongoTemplate`……Spring 會**一路往下找**，先把最底層的建好
5. 全部到齊後，呼叫建構子：`new DailyBonusService(walletService, transactionRepository, walletProperties)`
6. 存進容器。之後 `WalletController` 需要 `DailyBonusService` 時，拿到的就是這一個

畫成圖：

```
WalletController
 ├─ WalletService ──────────────┬─ WalletRepository（Spring Data 自動產生）
 │                              ├─ WalletTransactionRepository
 │                              ├─ MongoTemplate（Spring Boot 自動設定）
 │                              └─ WalletProperties（讀 application.properties）
 └─ DailyBonusService
     ├─ WalletService（同一個！）
     ├─ WalletTransactionRepository（同一個！）
     └─ WalletProperties（同一個！）
```

### 找不到依賴會怎樣

如果某個 Service 宣告了一個不存在的 Bean，**啟動就會失敗**：

```
***************************
APPLICATION FAILED TO START
***************************
Parameter 2 of constructor in com.thirtylab.wallet.service.DailyBonusService required a bean of type 'com.thirtylab.xxx.Something' that could not be found.
```

看到這個錯誤，檢查：那個 class 有沒有加 `@Service` / `@Component`？是不是放在 `com.thirtylab` 外面（掃描不到）？

### 循環依賴

A 需要 B、B 又需要 A → Spring 不知道先建哪個 → 啟動失敗（`The dependencies of some of the beans in the application context form a cycle`）。這也是為什麼這個專案規定**模組的依賴只能單向**：`betting` 用 `draw`，`draw` 就不能反過來用 `betting`。

## 5. 單例：所有人共用同一個物件

Bean 預設只有**一個實例**，所有請求共用。很重要的後果：

> ⚠️ **不要把「這次請求的資料」存在 Service 的欄位裡**。

```java
// ❌ 錯誤示範
@Service
public class BadService {
    private String currentUserId;          // 所有人共用！
    public void handle(String userId) {
        this.currentUserId = userId;       // A 的請求剛設好，B 的請求就把它蓋掉了
        ...
    }
}
```

這個專案的 Service 欄位**全部是 `private final` 的依賴**，請求相關的資料（`userId`、`now`）全部用**方法參數**傳。這樣 1000 個請求同時進來也不會互相干擾。

≈ 在 Node 裡，你不會把使用者資料存在 module 層級的變數；道理一樣。

## 6. 代理（Proxy）與 `@Transactional` 的陷阱 ⚠️

這是 Spring 最容易踩、這個專案也真的踩過的坑，一定要懂。

### `@Transactional` 是怎麼運作的

```java
// wallet/service/WalletService.java
@Transactional
public long credit(String userId, long amount, WalletTransactionType type, String refId) {
    // ① 加餘額
    Wallet wallet = mongoTemplate.findAndModify(..., new Update().inc("balance", amount)...);
    // ② 寫一筆流水
    record(userId, type, amount, wallet.getBalance(), refId);
    return wallet.getBalance();
}
```

我們希望 ① 和 ② **一起成功、一起失敗**。如果 ② 撞到唯一索引（代表這筆已經加過了），① 也要取消，不然錢會被加兩次。

Spring 的做法：**不給你真的 `WalletService`，而是給一個包裝過的「代理」**。

```
DailyBonusService 拿到的 walletService
   │
   ▼
┌──────────────── 代理（Spring 自動產生）─────────────────┐
│  credit(...) {                                          │
│    開始交易                                              │
│    try {                                                │
│      真正的 walletService.credit(...)  ──────────────┐   │
│      提交交易                                        │   │
│    } catch (RuntimeException e) {                   │   │
│      回滾交易（① 的加餘額也取消）                     │   │
│      throw e                                        │   │
│    }                                                │   │
│  }                                                  │   │
└─────────────────────────────────────────────────────┼───┘
                                                      ▼
                                          真正的 WalletService
```

≈ 前端的 axios interceptor：你呼叫 `api.get()`，interceptor 先幫你加 header、處理錯誤，再呼叫真正的請求。

### 陷阱：自己呼叫自己，代理不會經過

```java
@Service
public class WalletService {
    public void claimDailyBonus(String userId) {
        this.credit(userId, 1000, DAILY_BONUS, refId);   // ❌ this 是真正的物件，不是代理
    }

    @Transactional
    public long credit(...) { ... }
}
```

`this.credit(...)` 是物件內部直接呼叫，**根本沒經過代理**，所以交易不會開。≈ 你設了 axios interceptor，但這裡直接用 `fetch`，interceptor 當然不會跑。

**這個專案實測的結果**：每日簽到原本寫在 `WalletService` 裡、自己呼叫 `credit`。同一天簽到第二次時，流水因為唯一索引寫不進去，**但餘額已經加上去了**，憑空多了 1,000 積分。

**解法**：把簽到搬到另一個 class `DailyBonusService`，從外面呼叫 `walletService.credit(...)`，這樣一定會經過代理：

```java
// wallet/service/DailyBonusService.java
long balance = walletService.credit(userId, amount, WalletTransactionType.DAILY_BONUS, refId);
```

> 記住：**`@Transactional`、`@Async`、`@Cacheable` 這些「加在方法上的魔法」，都只有從別的 Bean 呼叫時才有效**。

## 7. 條件式 Bean：設定不符就不建立

```java
// config/SchedulingConfig.java
@Configuration
@EnableScheduling
@ConditionalOnProperty(prefix = "app.scheduling", name = "enabled", havingValue = "true", matchIfMissing = true)
public class SchedulingConfig { ... }
```

- `app.scheduling.enabled=true`（或沒寫，`matchIfMissing = true`）→ 這個 class 會被建立，排程開始跑
- 測試的設定檔寫了 `app.scheduling.enabled=false` → **這個 class 根本不會被建立**，測試時不會每秒開獎

`PrizeSummaryBackfill` 也用同一個開關，所以測試時不會在啟動時補算。

## 8. 拿 Bean 的三種方式

| 寫法 | 用在哪 | 專案例子 |
|---|---|---|
| 建構子注入（`private final` + `@RequiredArgsConstructor`） | **所有正式程式碼都用這個** | 每個 Service |
| `@Bean` 方法的參數 | 建立 Bean 時需要別的 Bean | `SecurityConfig.securityFilterChain(HttpSecurity http, JwtService jwtService, ...)` |
| `@Autowired` 欄位注入 | 只在測試類別用（測試沒有建構子） | `@Autowired private SettlementService settlementService;` |

**為什麼正式程式碼不用 `@Autowired` 欄位注入？** 建構子注入的欄位可以是 `final`（不會被改掉），而且單元測試時可以直接 `new WalletService(假的repo, ...)`，不需要啟動 Spring。

## 9. 同一個型別有好幾個 Bean 時

```java
// config/SecurityConfig.java
@Qualifier("handlerExceptionResolver") HandlerExceptionResolver resolver
```

Spring 裡有好幾個 `HandlerExceptionResolver`，只寫型別的話 Spring 不知道要哪一個，所以用 `@Qualifier` 指定名稱。

---

## 小練習

1. 在 IntelliJ 打開 `BettingService`，看它的 7 個依賴。按住 `Ctrl` 點 `DrawService`，再看 `DrawService` 依賴誰。畫出 `BettingService` 往下的依賴樹。
2. 想像把 `WalletService` 的 `private final MongoTemplate mongoTemplate;` 的 `final` 拿掉，會發生什麼事？什麼時候才會發現？
   <details><summary>答案</summary>Lombok 不會把它放進建構子，Spring 也就不會注入，欄位是 null。啟動不會失敗，要等到第一次呼叫用到 mongoTemplate 的方法才會 NullPointerException。</details>
3. 為什麼 `DailyBonusService` 不能直接寫在 `WalletService` 裡？用自己的話解釋一次。
4. 把 `application-test.properties` 的 `app.scheduling.enabled=false` 拿掉再跑測試，你覺得會發生什麼？（**不要真的做**，想就好：排程會在測試資料庫每秒開獎，測試的期數會被改掉）

上一章：[02 Java 語法](02-java-for-ts.md)　下一章：[04 設定檔](04-configuration.md)
