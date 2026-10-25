# S2 IoC 容器與 AOP 深入

[專案教程第 3 章](../backend/03-spring-bean-di.md) 講了基本的 Bean 和依賴注入。這章補完整。

## 1. IoC 是什麼

**IoC（Inversion of Control，控制反轉）**：物件不自己建立依賴，而是由外部（容器）建立好再交給它。DI（依賴注入）是實現 IoC 的方式。

```java
// 自己控制：
class OrderService {
    private final PaymentClient client = new StripeClient("key");   // 寫死了，換不掉、測不了
}

// 控制反轉：
class OrderService {
    private final PaymentClient client;
    OrderService(PaymentClient client) { this.client = client; }    // 誰給我都可以
}
```

好處：可以換實作（正式環境用 Stripe、測試用假的）、物件之間鬆散耦合。

**`ApplicationContext`** 就是 Spring 的 IoC 容器，所有 Bean 都在裡面。

## 2. 定義 Bean 的方式

| 方式 | 寫法 | 用在 |
|---|---|---|
| 元件掃描 | class 上加 `@Component` / `@Service` / `@Repository` / `@Controller` | 自己寫的 class |
| `@Bean` 方法 | `@Configuration` 類別裡的方法 | 第三方的 class、需要複雜建立邏輯 |
| 設定類別 | `@ConfigurationProperties` | 設定值 |
| Spring Data | `interface X extends MongoRepository<...>` | Repository |

`@Repository` 除了標記，還會把資料庫的例外轉換成 Spring 的 `DataAccessException`。

## 3. 注入的三種方式

```java
// ① 建構子注入（推薦，30 Lab 全部用這個）
@Service
@RequiredArgsConstructor
public class A {
    private final B b;
}

// ② 欄位注入（只在測試類別用）
@Service
public class A {
    @Autowired private B b;
}

// ③ setter 注入（可選的依賴）
@Service
public class A {
    private B b;
    @Autowired(required = false)
    public void setB(B b) { this.b = b; }
}
```

**為什麼推薦建構子注入？**

- 欄位可以是 `final`，不會被意外改掉
- 依賴一目了然；依賴太多（超過 5~6 個）會很明顯，提醒你這個 class 做太多事了
- 單元測試可以直接 `new A(fakeB)`，不需要 Spring
- 循環依賴會在啟動時就被發現

## 4. 同型別有多個 Bean

```java
public interface Notifier { void send(String msg); }
@Component public class EmailNotifier implements Notifier { ... }
@Component public class SmsNotifier implements Notifier { ... }

@Service
@RequiredArgsConstructor
public class AlertService {
    private final Notifier notifier;    // ❌ 啟動失敗：expected single matching bean but found 2
}
```

解法：

```java
// ① @Primary：預設用這個
@Component @Primary public class EmailNotifier implements Notifier { ... }

// ② @Qualifier：指定名稱（Bean 的名稱預設是 class 名稱的 camelCase）
public AlertService(@Qualifier("smsNotifier") Notifier notifier) { ... }
// ⚠️ 用 Lombok 的 @RequiredArgsConstructor 時，欄位上的 @Qualifier 不一定會被複製到建構子參數上；
//    最保險是自己寫建構子，或在 lombok.config 加 lombok.copyableAnnotations += org.springframework.beans.factory.annotation.Qualifier

// ③ 全部都要：注入 List 或 Map
private final List<Notifier> notifiers;              // 所有實作
private final Map<String, Notifier> notifiersByName; // key 是 Bean 名稱
```

③ 很適合「策略模式」：例如每種玩法一個實作，用 Map 依玩法找。

## 5. 作用域（Scope）

| Scope | 實例數量 | 用途 |
|---|---|---|
| **`singleton`**（預設） | 整個容器一個 | 幾乎所有 Service、Repository |
| `prototype` | 每次注入 / 取得都建新的 | 有狀態、不能共用的物件 |
| `request` | 每個 HTTP 請求一個 | 請求範圍的資料 |
| `session` | 每個 HTTP session 一個 | |

```java
@Component
@Scope("prototype")
public class ReportBuilder { ... }
```

> ⚠️ 單例 Bean 注入 prototype Bean，**只會在建立單例時注入一次**，之後一直是同一個。要每次都拿新的，注入 `ObjectProvider<ReportBuilder>` 再呼叫 `getObject()`。

## 6. 生命週期

```java
@Component
public class CacheWarmer {

    public CacheWarmer(ProductService service) { ... }   // ① 建構子：依賴已經注入

    @PostConstruct                                       // ② 所有依賴注入完成後執行一次
    void init() { log.info("開始預熱快取"); }

    @PreDestroy                                          // ③ 容器關閉前執行（釋放資源）
    void cleanup() { log.info("關閉"); }
}
```

| 想在什麼時候做事 | 用 |
|---|---|
| 這個 Bean 建立好之後 | `@PostConstruct` |
| **整個程式啟動完成後**（所有 Bean 都好了） | `ApplicationRunner` / `CommandLineRunner`（30 Lab 的 `PrizeSummaryBackfill`），或 `@EventListener(ApplicationReadyEvent.class)` |
| 程式關閉前 | `@PreDestroy` |

≈ NestJS 的 `onModuleInit`、`onApplicationBootstrap`、`onModuleDestroy`。

## 7. 其他常用註解

```java
@Value("${app.cors.allowed-origins}")        // 注入單一設定值
private String[] origins;

@Value("${app.feature.enabled:false}")       // 冒號後面是預設值
private boolean enabled;

@Lazy                                        // 第一次用到時才建立（加快啟動、打破循環依賴）
@DependsOn("migrationRunner")                // 強制先建立另一個 Bean
@Order(1)                                    // 多個同型別的 Bean 排序（注入 List 時、Filter 的順序）
```

## 8. AOP：切面導向

### 要解決什麼問題

很多功能需要「在很多方法執行前後做同一件事」：

- 開交易、提交 / 回滾（`@Transactional`）
- 記錄執行時間、記錄日誌
- 權限檢查（`@PreAuthorize`）
- 快取（`@Cacheable`）
- 非同步執行（`@Async`）

每個方法都手寫一次很囉嗦。**AOP** 讓你把這些「橫切關注點」寫在一個地方，用註解或規則套用到很多方法。

≈ 前端的 axios interceptor、Express middleware、NestJS 的 Interceptor。

### 原理：代理

```
呼叫的人 ──▶ 代理物件 ──（前置處理）──▶ 真正的物件.method() ──▶（後置處理）──▶ 回傳
```

Spring 在啟動時，如果發現某個 Bean 需要 AOP（例如有 `@Transactional` 方法），就**不把原本的物件放進容器，而是放一個包裝過的代理**。其他 Bean 注入拿到的都是代理。

兩種代理方式：

| | JDK 動態代理 | CGLIB |
|---|---|---|
| 條件 | 目標實作了介面 | 任何 class（建立子類別） |
| Spring Boot 預設 | | ✅ |
| 限制 | 只能代理介面的方法 | `final` class、`final` 方法、`private` 方法不能代理 |

### 自我呼叫的陷阱（再強調一次）

```java
@Service
public class WalletService {
    public void a() {
        this.b();                 // ❌ this 是原本的物件，沒經過代理 → @Transactional 無效
    }
    @Transactional
    public void b() { ... }
}
```

**所有靠代理的功能都有這個問題**：`@Transactional`、`@Async`、`@Cacheable`、`@Retryable`、`@PreAuthorize`。另外 `private` 方法加這些註解也沒用（代理碰不到）。

解法（由好到差）：

1. **把方法搬到另一個 Bean**（30 Lab 的 `DailyBonusService` 就是這樣）
2. 用 `TransactionTemplate` 這種程式寫法，不靠註解
3. 注入自己（`@Lazy` 注入自己的代理）：能動但很怪，不推薦

### 自己寫一個切面

```java
@Aspect
@Component
@Slf4j
public class TimingAspect {

    @Around("@annotation(com.thirtylab.common.Timed)")      // 套用到有 @Timed 的方法
    public Object time(ProceedingJoinPoint pjp) throws Throwable {
        long start = System.nanoTime();
        try {
            return pjp.proceed();                            // 呼叫真正的方法
        } finally {
            log.info("{} 花了 {} ms", pjp.getSignature().toShortString(), (System.nanoTime() - start) / 1_000_000);
        }
    }
}

@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.METHOD)
public @interface Timed { }

// 使用
@Timed
public Optional<Draw> settleNext(Instant now) { ... }
```

需要加 `spring-boot-starter-aspectj` 依賴（Spring Boot 3 以前叫 `spring-boot-starter-aop`，Boot 4 改名）。

| 通知類型 | 什麼時候執行 |
|---|---|
| `@Before` | 方法執行前 |
| `@AfterReturning` | 成功回傳後 |
| `@AfterThrowing` | 丟例外後 |
| `@After` | 不管成功失敗（≈ finally） |
| `@Around` | 包住整個方法，可以決定要不要執行、改參數、改回傳值 |

## 9. 事件：模組之間的鬆散耦合

```java
// 發出事件
public record DrawSettledEvent(String drawNo, long totalPayout) { }

@Service
@RequiredArgsConstructor
public class SettlementService {
    private final ApplicationEventPublisher events;

    public void settle(...) {
        ...
        events.publishEvent(new DrawSettledEvent(drawNo, total));
    }
}

// 接收事件（別的模組，不需要 SettlementService 知道它的存在）
@Component
public class LeaderboardCacheEvictor {
    @EventListener
    public void on(DrawSettledEvent e) { cache.clear(); }
}
```

- 預設是**同步**的：`publishEvent` 會等所有 listener 執行完
- 加 `@Async` 變成非同步
- `@TransactionalEventListener`：**等交易提交成功之後**才執行（例如交易成功後才發通知，交易回滾就不發）

≈ Node 的 `EventEmitter`、NestJS 的 `@nestjs/event-emitter`。30 Lab 目前用直接呼叫 Service，模組變多時可以改用事件解耦。

---

## 面試常問

- **IoC 和 DI 是什麼？** IoC 是控制反轉，物件的建立和組裝交給容器；DI 是實現方式，依賴從外部注入
- **Bean 的作用域？** singleton、prototype、request、session…，預設 singleton
- **Bean 的生命週期？** 建立實例 → 注入依賴 → `@PostConstruct` → 使用 → `@PreDestroy` → 銷毀
- **建構子注入和欄位注入的差別？** 見第 3 節
- **什麼是 AOP？Spring AOP 怎麼實作？** 把橫切關注點抽出來；用代理（JDK 動態代理或 CGLIB）
- **`@Transactional` 什麼時候會失效？** 自我呼叫、`private` 方法、例外被 catch 掉沒丟出、丟的是 checked 例外（預設不回滾）、class 不是 Spring 管理的 Bean
- **循環依賴怎麼處理？** 最好重新設計（抽出共用的部分）；建構子注入時 Spring 直接報錯；`@Lazy` 可以暫時打破

## 小練習

1. 寫上面的 `TimingAspect` 加到 30 Lab 的 `SettlementService.settleNext`，看日誌印出結算花了多久
2. 在任一個 Service 加 `@PostConstruct` 方法印一行字，重啟後端看它什麼時候印出來（跟 `Started ThirtyLabBackendApplication` 比較先後）
3. 解釋為什麼 `DrawService.tick` 裡呼叫 `this.closeDue(now)` 不會有問題（提示：`closeDue` 有沒有用到靠代理的功能？）

上一章：[S1 Spring Boot 全貌](10-spring-boot-overview.md)　下一章：[S3 Web 開發深入](12-web-mvc.md)
