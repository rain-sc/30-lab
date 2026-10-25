# J8 日期時間與新版 Java

## Part 1：`java.time`

JavaScript 只有一個 `Date`，什麼都混在一起。Java 8 的 `java.time` 把「時間」分成好幾種概念，**選對型別就不會出錯**。

> 不要用 `java.util.Date`、`Calendar`、`SimpleDateFormat`：設計不良、可變、`SimpleDateFormat` 不是執行緒安全。只在跟舊的 API 互動時才轉換（30 Lab 的 `JwtService` 因為 jjwt 要 `Date`，所以有 `Date.from(now)`）。

### 1. 選哪個型別

| 型別 | 代表 | 例子 | 什麼時候用 |
|---|---|---|---|
| **`Instant`** | 時間軸上的一個點（UTC），沒有時區概念 | `2026-10-23T03:30:00Z` | **存資料庫、API 傳輸、記錄事件發生的時間**（30 Lab 全部用這個） |
| `LocalDate` | 只有日期，沒有時間、沒有時區 | `2026-10-23` | 生日、「哪一天」（30 Lab 的每日簽到） |
| `LocalTime` | 只有時間 | `09:30` | 營業時間 |
| `LocalDateTime` | 日期 + 時間，**沒有時區** | `2026-10-23T09:30` | 很少用；容易誤用 |
| `ZonedDateTime` | 日期 + 時間 + 時區 | `2026-10-23T11:30+08:00[Asia/Taipei]` | 要顯示給某個時區的人看、跨時區計算 |
| `OffsetDateTime` | 日期 + 時間 + 偏移 | `2026-10-23T11:30+08:00` | 跟外部系統交換時間 |
| `Duration` | 時間長度（秒、奈秒） | 5 分鐘 | 計時、間隔（30 Lab 的 `draw-interval`） |
| `Period` | 日期長度（年、月、日） | 1 個月 | 「下個月同一天」 |

> ⚠️ **`LocalDateTime` 是最常見的錯誤來源**：它不知道是哪個時區的時間。伺服器在台灣、資料庫在美國，存進去讀出來就差了 13 小時。**存時間點一律用 `Instant`**，顯示時才轉成使用者的時區（30 Lab 是前端負責轉）。

### 2. 常用操作

```java
Instant now = Instant.now();
Instant later = now.plus(Duration.ofMinutes(5));
Instant earlier = now.minusSeconds(15);
now.isBefore(later);                                   // true
Duration.between(now, later).toSeconds();             // 300
now.toEpochMilli();                                    // ≈ Date.now()
Instant.parse("2026-10-23T03:30:00Z");
now.truncatedTo(ChronoUnit.MILLIS);                    // 去掉毫秒以下（MongoDB 只存到毫秒）

LocalDate today = LocalDate.now(ZoneOffset.UTC);       // ⚠️ 不給時區就用伺服器的時區
LocalDate.ofInstant(now, ZoneId.of("Asia/Taipei"));    // 這個時間點在台灣是哪一天
today.plusDays(1);
today.getDayOfWeek();                                  // THURSDAY
today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));   // 本週一
today.atStartOfDay(ZoneOffset.UTC).toInstant();        // 這一天 UTC 00:00 的時間點

ZonedDateTime taipei = now.atZone(ZoneId.of("Asia/Taipei"));
taipei.getHour();
```

### 3. 格式化與解析

```java
DateTimeFormatter f = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
LocalDateTime.now().format(f);                       // "2026-10-23 11:30:00"

DateTimeFormatter withZone = DateTimeFormatter.ofPattern("yyyyMMdd").withZone(ZoneOffset.UTC);
withZone.format(Instant.now());                      // "20261023"（30 Lab 的期號就是這樣產生的）
```

| 符號 | 意思 |
|---|---|
| `yyyy` | 年（⚠️ `YYYY` 是「週的年份」，12 月底會變成下一年） |
| `MM` / `mm` | 月 / **分**（大小寫不同！） |
| `dd` | 日 |
| `HH` / `hh` | 24 小時制 / 12 小時制 |
| `ss` / `SSS` | 秒 / 毫秒 |

`DateTimeFormatter` 是不可變、執行緒安全的，可以放在 `static final`。

### 4. 讓時間可以測試

```java
// ❌ 方法裡自己呼叫 now()，測試沒辦法控制時間
public boolean isOpen() { return Instant.now().isBefore(closeAt); }

// ✅ 時間從外面傳進來（30 Lab 的做法）
public boolean isOpen(Instant now) { return now.isBefore(closeAt); }

// ✅ 或注入 Clock
public class DrawService {
    private final Clock clock;                              // 正式環境：Clock.systemUTC()
    public boolean isOpen() { return Instant.now(clock).isBefore(closeAt); }
}
// 測試：new DrawService(Clock.fixed(Instant.parse("2026-10-23T03:29:59Z"), ZoneOffset.UTC))
```

---

## Part 2：Java 17~21 的新語法

網路上很多教學還是 Java 8 的寫法。下面這些是現在的寫法，這個專案都可以用。

### 5. `var`（Java 10）

```java
var map = new HashMap<String, List<Integer>>();     // 型別很長時好用
for (var entry : map.entrySet()) { ... }
```

只能用在區域變數。型別不明顯時（`var x = service.process();`）還是寫出型別比較好讀。

### 6. text block（Java 15）

```java
String json = """
        { "type": "PAYOUT",
          "amount": 160 }
        """;                     // 自動去掉共同的縮排
```

30 Lab 的聚合管線用這個寫 MongoDB 語法。**不能插值**，要用 `.formatted(...)`。

### 7. switch 運算式與模式比對

```java
// switch 運算式（Java 14）
int days = switch (month) {
    case FEBRUARY -> 28;
    case APRIL, JUNE, SEPTEMBER, NOVEMBER -> 30;
    default -> {
        log.debug("31 天的月份");
        yield 31;                         // 多行時用 yield 回傳值
    }
};

// instanceof 模式比對（Java 16）
if (obj instanceof String s && !s.isBlank()) {
    use(s);                               // 不用再 (String) obj 轉型
}

// switch 模式比對（Java 21）
String describe(Object o) {
    return switch (o) {
        case null -> "null";
        case Integer i when i > 100 -> "大數字 " + i;     // when：額外條件
        case Integer i -> "數字 " + i;
        case String s -> "字串 " + s;
        case List<?> list -> "清單，" + list.size() + " 個";
        default -> "其他";
    };
}
```

### 8. record 模式（Java 21）

```java
record Point(int x, int y) { }
record Line(Point from, Point to) { }

if (obj instanceof Line(Point(var x1, var y1), Point(var x2, var y2))) {
    double length = Math.hypot(x2 - x1, y2 - y1);   // 直接拆開，≈ JS 的解構
}

String where = switch (point) {
    case Point(var x, var y) when x == 0 && y == 0 -> "原點";
    case Point(var x, var y) when y == 0 -> "在 x 軸上";
    case Point p -> "其他";
};
```

### 9. sealed（Java 17）

見 [J3 第 10 節](03-oop.md)。配合 switch 模式比對，編譯器會檢查有沒有處理所有子類別。

### 10. Sequenced Collections（Java 21）

```java
list.getFirst();       // 以前：list.get(0)
list.getLast();        // 以前：list.get(list.size() - 1)
list.removeLast();
list.reversed();       // 反過來的「視窗」
linkedHashMap.firstEntry();
```

30 Lab 的 `LineExpander` 用了 `current.removeLast()`。

### 11. 其他小東西

| 功能 | 版本 | 例子 |
|---|---|---|
| `List.of` / `Set.of` / `Map.of` | 9 | 不可變集合 |
| `Optional.orElseThrow()`（無參數） | 10 | |
| `String.isBlank()` / `strip()` / `lines()` / `repeat()` | 11 | |
| `Files.readString` / `writeString` | 11 | 一行讀寫檔案 |
| `HttpClient` | 11 | 內建的 HTTP client |
| `Stream.toList()` | 16 | 取代 `collect(Collectors.toList())` |
| 更好的 NPE 訊息 | 14 | `because "user" is null` |
| `String.formatted()` | 15 | `"%d 注".formatted(n)` |
| 虛擬執行緒 | 21 | [J7](07-concurrency.md) |

---

## 面試常問

- **`Instant`、`LocalDateTime`、`ZonedDateTime` 的差別？** Instant 是 UTC 的時間點；LocalDateTime 沒有時區；ZonedDateTime 有時區。存資料用 Instant
- **為什麼不用 `Date` 和 `SimpleDateFormat`？** Date 可變、設計混亂；SimpleDateFormat 不是執行緒安全
- **Java 17 / 21 有什麼新功能？** record、sealed、text block、switch 運算式、模式比對、虛擬執行緒、sequenced collections

## 小練習

1. 算出「現在在台灣是幾點」和「現在在 UTC 是幾點」
2. 給一個 `Instant`，算出它在 UTC 是哪一週的週一（提示：30 Lab 的 `LeaderboardPeriod`）
3. 用 switch 模式比對寫一個方法：傳入 `Object`，是 `Integer` 回傳兩倍、是 `String` 回傳長度、其他回傳 -1

上一章：[J7 並發](07-concurrency.md)　下一章：[J9 Maven](09-maven.md)
