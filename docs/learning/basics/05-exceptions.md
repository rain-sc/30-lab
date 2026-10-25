# J5 例外處理

## 1. 例外的家族

```
Throwable
├── Error                         JVM 層級的嚴重問題，不要 catch
│   ├── OutOfMemoryError
│   └── StackOverflowError
└── Exception
    ├── IOException               ┐
    ├── SQLException              ├ checked：編譯器強迫你處理
    ├── InterruptedException      ┘
    └── RuntimeException          ┐
        ├── NullPointerException  │
        ├── IllegalArgumentException
        ├── IllegalStateException ├ unchecked：不用宣告
        ├── IndexOutOfBoundsException
        ├── ArithmeticException   │
        └── （你自己的 BusinessException）┘
```

JavaScript 的 `throw` 可以丟任何東西；Java 只能丟 `Throwable` 的子類別，而且分成兩種。

## 2. checked 與 unchecked

| | checked | unchecked |
|---|---|---|
| 繼承 | `Exception`（但不是 `RuntimeException`） | `RuntimeException` |
| 編譯器 | **強迫**你 `catch` 或在方法簽名寫 `throws` | 不管 |
| 代表 | 外部因素，呼叫的人應該能處理（檔案不存在、網路斷了） | 程式的 bug 或違反規則（null、參數不合法） |

```java
// checked：不處理就編譯不過
public String read(Path path) throws IOException {     // 宣告「我可能丟 IOException」，交給呼叫的人
    return Files.readString(path);
}

public String readOrEmpty(Path path) {
    try {
        return Files.readString(path);
    } catch (IOException e) {                          // 或是自己處理掉
        return "";
    }
}
```

**現代的 Java（尤其 Spring）偏好 unchecked**：checked 例外會讓每一層方法都要寫 `throws`，很囉嗦。Spring 把資料庫的錯誤都包成 unchecked 的 `DataAccessException`。30 Lab 的 `BusinessException` 也是 unchecked。

> ⚠️ **Spring 的 `@Transactional` 預設只在 unchecked 例外時回滾**，checked 例外會**提交**交易（[S4](13-data-jpa-transactions.md)）。這也是自訂例外繼承 `RuntimeException` 的理由之一。

## 3. try / catch / finally

```java
try {
    riskyOperation();
} catch (IllegalArgumentException | IllegalStateException e) {   // 一次接兩種（multi-catch）
    log.warn("參數或狀態不對: {}", e.getMessage());
} catch (RuntimeException e) {                                    // 比較廣的寫在後面
    log.error("未預期的錯誤", e);
    throw e;                                                      // 重新丟出
} finally {
    cleanup();                     // 不管成功、失敗、還是 return，最後一定執行
}
```

- **catch 的順序：子類別在前、父類別在後**。寫反了編譯器會報錯（後面那個永遠接不到）
- `finally` 裡**不要寫 `return`**，會把例外吞掉

## 4. try-with-resources：自動關閉

檔案、資料庫連線、網路連線用完一定要關。Java 7 起用這個寫法：

```java
try (BufferedReader reader = Files.newBufferedReader(path);
     BufferedWriter writer = Files.newBufferedWriter(out)) {
    String line;
    while ((line = reader.readLine()) != null) {
        writer.write(line.toUpperCase());
    }
}   // 離開 try 時自動呼叫 reader.close()、writer.close()，就算中途丟例外也會
```

只要實作 `AutoCloseable` 介面的物件都可以用。≈ TS 5.2 的 `using`，或 `try { } finally { await conn.close() }`。

用 Spring 時很少自己開連線（Repository、`MongoTemplate` 都幫你管好了），但讀檔、呼叫外部服務時會用到。

## 5. 自訂例外

```java
public class InsufficientPointsException extends RuntimeException {
    private final long balance;
    private final long required;

    public InsufficientPointsException(long balance, long required) {
        super("積分不足：餘額 " + balance + "，需要 " + required);
        this.balance = balance;
        this.required = required;
    }
    // getters...
}
```

### 兩種設計

| 設計 | 例子 | 優點 |
|---|---|---|
| 每種錯誤一個 class | `InsufficientPointsException`、`BettingClosedException` | 可以帶不同的資料，`catch` 時可以分開處理 |
| **一個 class + 錯誤碼** | `new BusinessException(ErrorCode.INSUFFICIENT_POINTS)` | 簡單，錯誤碼集中管理，前端依錯誤碼翻譯 |

30 Lab 用第二種，因為我們的錯誤主要是「轉成 HTTP 回應給前端」。

## 6. 例外鏈：保留原本的原因

```java
try {
    externalApi.call();
} catch (IOException e) {
    throw new BusinessException(ErrorCode.INTERNAL_ERROR, "呼叫外部服務失敗", e);   // 第三個參數是 cause
}
```

把原本的例外當成 `cause` 傳進去，錯誤堆疊會多一段 `Caused by: java.io.IOException: ...`，查問題時才知道根本原因。**轉換例外時一定要帶上原本的例外**。（30 Lab 的 `BusinessException` 目前沒有這個建構子，需要時要加上 `super(message, cause)`）

## 7. 讀錯誤堆疊

```
java.lang.IllegalStateException: 錢包不存在: u1
	at com.thirtylab.wallet.service.WalletService.credit(WalletService.java:112)
	at com.thirtylab.settlement.service.SettlementService.settle(SettlementService.java:76)
	at org.springframework.aop.framework.ReflectiveMethodInvocation.proceed(...)
	... 23 more
Caused by: org.springframework.dao.DuplicateKeyException: E11000 duplicate key error ...
	at ...
```

1. 第一行：**例外的類型和訊息**
2. `at ...`：從**最內層**（發生的地方）往外排。找第一個你自己 package（`com.thirtylab`）的那一行
3. `Caused by`：根本原因。**有好幾層時，最下面那個 `Caused by` 通常最重要**
4. `... 23 more`：跟上一段重複的部分，省略了

## 8. 原則

| ✅ 要 | ❌ 不要 |
|---|---|
| 只 catch 你知道怎麼處理的例外 | `catch (Exception e) {}` 什麼都不做（把錯誤吞掉，之後完全查不到） |
| 處理不了就往外丟 | catch 了只印 `e.printStackTrace()` 然後繼續跑 |
| 在邊界統一處理（Spring 的 `@RestControllerAdvice`） | 每個 Controller 方法都 try / catch |
| 錯誤訊息帶上下文（哪個 id、什麼值） | `throw new RuntimeException("error")` |
| 用標準例外表達常見問題 | 自己發明一堆意思重複的例外 |
| 轉換例外時帶 cause | 丟掉原本的例外 |

### 常用的標準例外

| 例外 | 什麼時候丟 |
|---|---|
| `IllegalArgumentException` | 參數不合法（`amount` 是負數） |
| `IllegalStateException` | 物件的狀態不允許這個操作（已經結算的期數又要結算） |
| `NullPointerException` | 不能是 null 的參數是 null（用 `Objects.requireNonNull`） |
| `UnsupportedOperationException` | 不支援這個操作 |

> 30 Lab 的空 catch：`WalletService.open()` 裡 `catch (DuplicateKeyException e) {}` 是**故意的**：開戶的獎勵流水已經存在，代表別的請求已經開過，忽略就好。這種情況一定要寫註解說明為什麼，不然讀的人會以為是漏了。

---

## 面試常問

- **checked 和 unchecked 的差別？** 見第 2 節
- **`Error` 和 `Exception` 的差別？** Error 是 JVM 層級無法恢復的問題（OOM），不應該 catch；Exception 是程式可以處理的
- **`finally` 一定會執行嗎？** 幾乎一定；除了 `System.exit()`、JVM 當掉、執行緒被殺
- **try-with-resources 的好處？** 自動關閉資源，就算發生例外也會關；多個資源依相反順序關閉
- **`throw` 和 `throws` 的差別？** `throw` 是丟出一個例外；`throws` 是在方法簽名宣告可能丟出的 checked 例外

## 小練習

1. 寫一個方法讀取一個不存在的檔案（`Files.readString(Path.of("nope.txt"))`），不處理例外，看編譯器怎麼說
2. 寫一個自訂的 `BettingClosedException extends RuntimeException`，帶 `drawNo` 欄位
3. 在 IntelliJ 裡故意讓後端丟一個 NPE，從 console 的錯誤堆疊找出是哪一行

上一章：[J4 泛型與集合](04-generics-collections.md)　下一章：[J6 Lambda、Optional、Stream](06-functional-streams.md)
