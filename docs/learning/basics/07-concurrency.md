# J7 並發

這是 Java 跟 Node 差最多的地方。Node 只有一條主執行緒，你從來不用擔心「兩段程式同時改同一個變數」。**Java 的 Web 伺服器同時有幾十、幾百條執行緒在跑**，每個請求一條。

## 1. 執行緒

```java
Thread t = new Thread(() -> {
    System.out.println("在另一條執行緒: " + Thread.currentThread().getName());
});
t.start();          // 開始執行（不是 run()，run() 只是在目前的執行緒呼叫方法）
t.join();           // 等它跑完（≈ await）
```

**實務上幾乎不會自己 `new Thread`**，而是用執行緒池（第 3 節）或交給框架（Tomcat、`@Async`、`@Scheduled`）。

### 你的 Spring 程式裡有哪些執行緒

| 執行緒 | 名稱 | 做什麼 |
|---|---|---|
| Tomcat 請求執行緒 | `http-nio-8088-exec-1` ~ `-200` | 每個 HTTP 請求一條 |
| 排程執行緒 | `scheduler-1`、`scheduler-2`（30 Lab 自己設的） | `@Scheduled` |
| WebSocket 執行緒 | `clientInboundChannel-*`、`MessageBroker-*` | STOMP 訊息 |
| MongoDB driver 的執行緒 | | 連線監控 |

後端 console 每一行日誌都有 `[nio-8088-exec-8]` 這種欄位，就是那行是哪條執行緒印的。

## 2. 競爭條件（Race Condition）

```java
public class Counter {
    private int count = 0;
    public void increment() {
        count++;           // 看起來是一步，其實是三步：讀 → 加 1 → 寫回
    }
}

// 兩條執行緒各呼叫 1000 次
// 預期 2000，實際可能是 1873
```

```
執行緒 A：讀到 5
執行緒 B：讀到 5
執行緒 A：寫回 6
執行緒 B：寫回 6     ← A 的那次 +1 不見了
```

**這就是為什麼 Spring 的 Service 不能把請求的資料存在欄位**（[專案教程第 3 章](../backend/03-spring-bean-di.md)）：Service 是單例，所有請求的執行緒共用同一個物件。

> 同樣的問題也會發生在資料庫：兩個請求同時「讀餘額 → 判斷 → 寫回」。30 Lab 用 MongoDB 的條件更新 `$inc` 解決（[專案教程第 8、9 章](../backend/09-betting-transactions.md)），原理跟下面的原子操作一樣。

## 3. 解決辦法

### ① 不要共享可變的狀態（最好的辦法）

- 資料放在方法的區域變數（每條執行緒各自一份）
- 用不可變的物件（record、`List.of`）
- 狀態放在資料庫，讓資料庫處理並發

**30 Lab 的 Java 程式碼幾乎沒有共享的可變狀態**，所以完全不需要下面這些東西。這也是一般 Spring 後端的常態。

### ② 原子類別

```java
private final AtomicInteger count = new AtomicInteger();
count.incrementAndGet();             // 讀 + 加 + 寫是一個不可分割的操作
private final AtomicLong total = new AtomicLong();
total.addAndGet(500);
```

### ③ 執行緒安全的集合

```java
Map<String, Integer> map = new ConcurrentHashMap<>();
map.merge(key, 1, Integer::sum);           // 原子操作
map.computeIfAbsent(key, k -> load(k));    // 原子操作
```

> ⚠️ 用了 `ConcurrentHashMap` 也要用它的原子方法。`if (!map.containsKey(k)) map.put(k, v);` 兩步之間還是可能被別的執行緒插隊，要用 `putIfAbsent`。

### ④ `synchronized`：同時只能有一條執行緒進來

```java
public synchronized void increment() {      // 鎖住這個物件
    count++;
}

private final Object lock = new Object();
public void transfer() {
    synchronized (lock) {                   // 只鎖一小段
        ...
    }
}
```

- 簡單，但會讓其他執行緒排隊等，用太多會變慢
- **只在單一 JVM 裡有效**：部署兩台伺服器時，A 機的鎖管不到 B 機。跨機器要用資料庫的條件更新、唯一索引，或 Redis 分散式鎖

### ⑤ `volatile`

```java
private volatile boolean running = true;    // 一條執行緒改了，其他執行緒馬上看得到
```

只保證「看得到最新的值」，**不保證 `count++` 這種複合操作是原子的**。用在簡單的旗標。

## 4. 執行緒池與 `ExecutorService`

建立執行緒很貴，所以用執行緒池重複使用：

```java
ExecutorService pool = Executors.newFixedThreadPool(4);      // 4 條執行緒

Future<Integer> future = pool.submit(() -> heavyCompute());  // 交出一個工作，馬上回傳 Future
Integer result = future.get();                               // 等結果（阻塞）

pool.shutdown();          // 用完一定要關，不然程式不會結束
```

≈ Node 的 worker pool，但 Java 的執行緒可以直接共享記憶體。

30 Lab 的 `SchedulingConfig` 建了一個 2 條執行緒的 `ThreadPoolTaskScheduler`（Spring 包裝的執行緒池）；並發測試用了 `Executors.newFixedThreadPool(5)`。

## 5. `CompletableFuture`：Java 的 Promise

```java
CompletableFuture<User> userF = CompletableFuture.supplyAsync(() -> userService.find(id));
CompletableFuture<Wallet> walletF = CompletableFuture.supplyAsync(() -> walletService.find(id));

// ≈ Promise.all
CompletableFuture.allOf(userF, walletF).join();
Profile profile = new Profile(userF.join(), walletF.join());

// ≈ .then / .catch
CompletableFuture.supplyAsync(() -> fetch())
        .thenApply(data -> parse(data))          // ≈ .then(data => parse(data))
        .thenAccept(result -> save(result))
        .exceptionally(e -> { log.error("失敗", e); return null; });   // ≈ .catch
```

| Promise | CompletableFuture |
|---|---|
| `new Promise(...)` / `async` 函式 | `CompletableFuture.supplyAsync(() -> ...)` |
| `.then(x => y)` | `.thenApply(x -> y)` |
| `.then(x => otherPromise)` | `.thenCompose(x -> otherFuture)` |
| `.catch(e => ...)` | `.exceptionally(e -> ...)` |
| `await p` | `p.join()`（阻塞目前的執行緒） |
| `Promise.all([a, b])` | `CompletableFuture.allOf(a, b)` |
| `Promise.race` | `CompletableFuture.anyOf` |

**什麼時候用？** 一個請求要同時呼叫好幾個慢的外部服務，平行執行可以縮短總時間。一般的 CRUD 不需要。

## 6. 虛擬執行緒（Java 21）

傳統的執行緒（平台執行緒）對應作業系統的執行緒，很貴（約 1 MB stack），所以 Tomcat 預設最多 200 條。第 201 個同時進來的請求要排隊，就算前 200 個都只是在等資料庫。

**虛擬執行緒**很便宜（幾 KB），可以開幾百萬條。等 I/O 時，JVM 會自動把它從真正的執行緒上拿下來，讓別的虛擬執行緒用：

```java
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    for (int i = 0; i < 100_000; i++) {
        executor.submit(() -> callSlowApi());     // 10 萬條虛擬執行緒，沒問題
    }
}
```

Spring Boot 3.2+ 一行設定就讓 Tomcat 用虛擬執行緒處理請求：

```properties
spring.threads.virtual.enabled=true
```

效果 ≈ Node 的非同步 I/O（等待時不佔用執行緒），但**程式碼還是同步的寫法**，不用 `async` / `await`。30 Lab 目前沒開。

## 7. Spring 裡的非同步

```java
@Configuration
@EnableAsync
public class AsyncConfig { }

@Service
public class MailService {
    @Async                                     // 呼叫後馬上返回，實際在另一條執行緒執行
    public void sendWelcome(String email) { ... }

    @Async
    public CompletableFuture<Report> build() { ... }   // 需要結果時回傳 CompletableFuture
}
```

> ⚠️ `@Async` 跟 `@Transactional` 一樣靠代理實作：**同一個 class 裡自己呼叫不會非同步**（[S2](11-ioc-aop.md)）。

---

## 常見錯誤

| 現象 | 原因 |
|---|---|
| 數字偶爾少算 | 多條執行緒同時改共享變數 |
| `ConcurrentModificationException` | 一條執行緒在走訪集合，另一條在改 |
| 程式跑完不會結束 | 執行緒池沒 `shutdown` |
| 偶爾卡住不動 | 死鎖：A 等 B 的鎖、B 等 A 的鎖 |
| 單機測試正常，部署兩台就出錯 | 用了 `synchronized` 或記憶體裡的狀態，跨機器無效 |

## 面試常問

- **執行緒和行程的差別？** 行程有自己的記憶體空間；同一個行程的執行緒共享記憶體
- **什麼是執行緒安全？** 多條執行緒同時使用時，結果還是正確的
- **`synchronized` 和 `volatile` 的差別？** synchronized 保證同時只有一條執行緒執行、也保證可見性；volatile 只保證可見性，不保證原子性
- **Spring 的 Bean 是執行緒安全的嗎？** 單例 Bean 本身不保證；只要不在欄位裡存可變狀態（無狀態的 Service）就安全
- **`Runnable` 和 `Callable` 的差別？** Runnable 沒有回傳值、不能丟 checked 例外；Callable 有回傳值、可以丟例外
- **為什麼用執行緒池？** 重複使用執行緒、限制同時的數量、避免無限制地建立執行緒耗盡資源
- **什麼是虛擬執行緒？** Java 21 的輕量執行緒，等 I/O 時不佔用作業系統執行緒，適合大量 I/O 密集的請求

## 小練習

1. 寫一個 `Counter`（`int count` + `count++`），用 `Executors.newFixedThreadPool(10)` 各呼叫 1000 次，印出結果；改成 `AtomicInteger` 再試一次
2. 用 `CompletableFuture.supplyAsync` 同時執行兩個 `Thread.sleep(1000)` 的工作，用 `allOf` 等它們，量量看總共花幾秒
3. 打開 30 Lab 的 `BettingServiceIntegrationTest.concurrentResendsWithSameKeyChargeOnce`，看它怎麼用執行緒池和 `CompletableFuture` 同時下注

上一章：[J6 Lambda、Optional、Stream](06-functional-streams.md)　下一章：[J8 日期時間與新版 Java](08-time-and-modern-java.md)
