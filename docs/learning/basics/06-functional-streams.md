# J6 Lambda、Optional、Stream

## 1. 函式介面：Java 的「函式型別」

TypeScript 可以直接寫函式型別 `(x: number) => string`。Java 沒有函式型別，**lambda 一定要對應到一個「只有一個抽象方法的介面」**（函式介面）。

```java
@FunctionalInterface
interface Validator {
    boolean validate(String value);        // 只有一個抽象方法
}

Validator notBlank = s -> !s.isBlank();     // lambda 實作了這個介面
notBlank.validate("  ");                     // false
```

### 不用自己定義：`java.util.function` 已經有了

| 介面 | 方法 | TS 對照 | 用途 |
|---|---|---|---|
| `Function<T, R>` | `R apply(T t)` | `(t: T) => R` | 轉換（`map`） |
| `BiFunction<T, U, R>` | `R apply(T t, U u)` | `(t: T, u: U) => R` | 兩個參數 |
| `Supplier<T>` | `T get()` | `() => T` | 延遲產生（`orElseGet`） |
| `Consumer<T>` | `void accept(T t)` | `(t: T) => void` | 做事不回傳（`forEach`） |
| `Predicate<T>` | `boolean test(T t)` | `(t: T) => boolean` | 判斷（`filter`） |
| `UnaryOperator<T>` | `T apply(T t)` | `(t: T) => T` | 同型別轉換 |
| `BinaryOperator<T>` | `T apply(T a, T b)` | `(a: T, b: T) => T` | 合併（`reduce`） |
| `Runnable` | `void run()` | `() => void` | 執行一段程式（執行緒） |
| `Callable<V>` | `V call() throws Exception` | `() => V` | 可以丟 checked 例外 |

基本型別有專用版本避免裝箱：`IntPredicate`、`ToLongFunction<T>`、`IntFunction<R>`…

```java
Function<String, Integer> length = String::length;
Function<Integer, Integer> doubled = x -> x * 2;
length.andThen(doubled).apply("abc");          // 6：組合函式

Predicate<String> empty = String::isEmpty;
Predicate<String> notEmpty = empty.negate();
Predicate<String> both = notEmpty.and(s -> s.length() < 10);
```

## 2. Lambda 的規則

```java
x -> x * 2                               // 一個參數可以省略括號
(a, b) -> a + b                          // 兩個以上要括號
() -> "hi"                               // 沒有參數
(String s) -> s.length()                 // 可以寫型別（通常不用）
x -> {                                   // 多行要大括號和 return
    int y = x * 2;
    return y + 1;
}
```

### 只能用「實質上 final」的外部變數

```java
int count = 0;
list.forEach(x -> count++);              // ❌ 編譯錯誤：lambda 不能改外面的區域變數

int base = 10;
list.stream().map(x -> x + base);        // ✅ 讀可以（base 之後沒被改過）
```

JavaScript 的閉包可以改外面的變數；Java 不行。要累加用 Stream 的 `sum()` / `reduce()`，或用 `AtomicInteger`、陣列這種可變的容器（不推薦）。

### 方法參考的四種寫法

| 寫法 | 等於 | 例子 |
|---|---|---|
| `ClassName::staticMethod` | `x -> ClassName.staticMethod(x)` | `Integer::parseInt` |
| `object::method` | `x -> object.method(x)` | `numbers::contains`、`System.out::println` |
| `ClassName::instanceMethod` | `x -> x.instanceMethod()` | `String::length`、`Ticket::getCost` |
| `ClassName::new` | `x -> new ClassName(x)` | `ArrayList::new` |

## 3. Optional：明確表示「可能沒有」

```java
Optional<User> user = userRepository.findById(id);
```

### 好的用法

```java
String name = user.map(User::getNickname).orElse("訪客");
User u = user.orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
user.ifPresent(u -> log.info("找到 {}", u.getId()));
user.filter(User::isEnabled).isPresent();

Optional.ofNullable(maybeNull);       // 可能是 null 的值包成 Optional
Optional.of(notNull);                 // 確定不是 null（是 null 會丟 NPE）
Optional.empty();
```

### 不好的用法

| ❌ | ✅ | 原因 |
|---|---|---|
| `if (opt.isPresent()) { x = opt.get(); }` | `opt.map(...)` / `orElse` / `ifPresent` | 跟 null 檢查沒差別 |
| `opt.get()` | `opt.orElseThrow()` | `get()` 在空的時候丟 `NoSuchElementException`，意圖不明顯 |
| `orElse(expensiveCall())` | `orElseGet(() -> expensiveCall())` | `orElse` 的參數**一定會先執行**，就算有值也是 |
| 欄位、方法參數用 `Optional` | 只用在**回傳值** | Optional 設計給回傳值用；欄位用 null 就好 |
| `Optional<List<X>>` | 回傳空的 List | 空集合已經能表達「沒有」 |

## 4. Stream：資料處理的管線

### 基本結構

```java
List<String> result = tickets.stream()          // ① 來源
        .filter(t -> t.getStatus() == WON)      // ② 中間操作（可以很多個）
        .map(Ticket::getUserId)
        .distinct()
        .sorted()
        .toList();                              // ③ 終端操作（只能一個）
```

### 跟 JS 陣列方法最大的不同：**懶惰執行**

```java
Stream<String> s = names.stream()
        .filter(n -> { System.out.println("filter " + n); return n.length() > 2; })
        .map(n -> { System.out.println("map " + n); return n.toUpperCase(); });
// 到這裡什麼都沒印！中間操作只是「記下要做什麼」

s.findFirst();   // 這時才執行，而且找到第一個就停，不會處理剩下的元素
```

- JS 的 `arr.filter().map()` 每一步都建立一個新陣列；Java 的 Stream 是**一個一個元素流過整條管線**，沒有中間的集合
- **沒有終端操作，什麼都不會發生**（新手常見：寫了 `.peek(...)` 或 `.map(...)` 卻沒效果）
- **一個 Stream 只能用一次**，第二次用會丟 `IllegalStateException`

### 中間操作

| 操作 | 作用 | JS 對照 |
|---|---|---|
| `filter(p)` | 留下符合的 | `filter` |
| `map(f)` | 轉換 | `map` |
| `flatMap(f)` | 每個元素轉成一個 Stream 再攤平 | `flatMap` |
| `distinct()` | 去重複（用 `equals`） | `[...new Set(arr)]` |
| `sorted()` / `sorted(comparator)` | 排序 | `sort` |
| `limit(n)` / `skip(n)` | 取前 n 個 / 跳過 n 個 | `slice` |
| `peek(f)` | 偷看（除錯用） | — |
| `takeWhile(p)` / `dropWhile(p)` | 符合條件時一直取 / 一直跳過 | — |
| `mapToInt` / `mapToLong` / `mapToDouble` | 轉成基本型別的 Stream（有 `sum`、`average`） | — |

### 終端操作

| 操作 | 回傳 | JS 對照 |
|---|---|---|
| `toList()` | 不可變的 List（Java 16+） | — |
| `collect(Collectors...)` | 各種集合（見下面） | `reduce` |
| `forEach(f)` | 無 | `forEach` |
| `count()` | `long` | `length` |
| `anyMatch` / `allMatch` / `noneMatch` | `boolean` | `some` / `every` / `!some` |
| `findFirst()` / `findAny()` | `Optional` | `find` |
| `min(c)` / `max(c)` | `Optional` | — |
| `reduce(0, Integer::sum)` | 合併的結果 | `reduce` |
| `sum()` / `average()`（基本型別 Stream） | 數字 / `OptionalDouble` | — |

### Collectors：收集成各種形狀

```java
// List / Set
.collect(Collectors.toList())                 // 可變的 List（舊寫法；新的用 .toList()）
.collect(Collectors.toSet())

// Map
.collect(Collectors.toMap(User::getId, User::getNickname))
// ⚠️ key 重複會丟 IllegalStateException，要指定怎麼合併：
.collect(Collectors.toMap(Ticket::getUserId, Ticket::getPayout, Long::sum))

// 分組 ≈ lodash groupBy
Map<String, List<Ticket>> byUser = tickets.stream()
        .collect(Collectors.groupingBy(Ticket::getUserId));

// 分組後再計算
Map<String, Long> payoutByUser = tickets.stream()
        .collect(Collectors.groupingBy(Ticket::getUserId, Collectors.summingLong(Ticket::getPayout)));
Map<TicketStatus, Long> countByStatus = tickets.stream()
        .collect(Collectors.groupingBy(Ticket::getStatus, Collectors.counting()));

// 分成兩組（true / false）
Map<Boolean, List<Ticket>> wonOrNot = tickets.stream()
        .collect(Collectors.partitioningBy(t -> t.getPayout() > 0));

// 串成字串 ≈ join
String csv = names.stream().collect(Collectors.joining(", ", "[", "]"));   // "[a, b, c]"
```

### 數字範圍

```java
IntStream.range(0, 5)              // 0 1 2 3 4
IntStream.rangeClosed(1, 30)       // 1 ~ 30
IntStream.rangeClosed(1, 30).boxed().toList();     // List<Integer>
Stream.iterate(1, x -> x * 2).limit(10)            // 1 2 4 8 ...
```

## 5. Stream 的注意事項

| ❌ | 原因 |
|---|---|
| 在 `map` / `filter` 裡改外部的狀態 | Stream 應該是無副作用的；要累加用 `collect` / `reduce` |
| 一個 Stream 用兩次 | 只能用一次 |
| 把簡單的迴圈硬改成很長的 Stream | 可讀性比較重要；有 `break`、多個累加變數時，普通的 for 迴圈比較清楚 |
| 隨便用 `parallelStream()` | 平行化有成本，資料量小反而更慢；在 Web 伺服器裡會跟請求搶執行緒；共用可變狀態會出錯 |
| `toMap` 沒處理重複的 key | 執行時才爆 |
| 用 `forEach` 加進另一個 List | 用 `collect` / `toList()` |

---

## 面試常問

- **什麼是函式介面？** 只有一個抽象方法的介面，可以用 lambda 實作，例如 `Runnable`、`Comparator`、`Function`
- **Stream 的中間操作和終端操作？** 中間操作回傳 Stream、懶惰執行；終端操作觸發執行並產生結果
- **`map` 和 `flatMap` 的差別？** `map` 一對一；`flatMap` 一對多後攤平
- **`Optional` 的用途？** 明確表示回傳值可能沒有，強迫呼叫的人處理；不要用在欄位和參數
- **`orElse` 和 `orElseGet` 的差別？** `orElse` 的參數一定會先算；`orElseGet` 只在空的時候才呼叫
- **parallel stream 什麼時候用？** 資料量大、CPU 密集、沒有共享狀態的計算；Web 請求裡一般不用

## 小練習

用下面的資料，在 jshell 或一個小測試裡寫 Stream：

```java
record Bet(String user, String tier, long payout) { }
var bets = List.of(
        new Bet("A", "SEVENTH", 20), new Bet("B", "FIFTH", 160),
        new Bet("A", "SIXTH", 80), new Bet("C", null, 0), new Bet("B", "SEVENTH", 20));
```

1. 有中獎的（`tier != null`）總共派了多少？
2. 每個人總共拿多少？（`Map<String, Long>`）
3. 每個獎級中了幾注？
4. 拿最多的那個人是誰？
5. 中獎的人，依名字排序、不重複，用逗號串起來

<details>
<summary>參考答案</summary>

```java
bets.stream().filter(b -> b.tier() != null).mapToLong(Bet::payout).sum();                      // 280
bets.stream().collect(Collectors.groupingBy(Bet::user, Collectors.summingLong(Bet::payout)));  // {A=100, B=180, C=0}
bets.stream().filter(b -> b.tier() != null).collect(Collectors.groupingBy(Bet::tier, Collectors.counting()));
bets.stream().collect(Collectors.groupingBy(Bet::user, Collectors.summingLong(Bet::payout)))
        .entrySet().stream().max(Map.Entry.comparingByValue()).map(Map.Entry::getKey).orElseThrow();   // B
bets.stream().filter(b -> b.tier() != null).map(Bet::user).distinct().sorted().collect(Collectors.joining(","));  // A,B
```
</details>

上一章：[J5 例外處理](05-exceptions.md)　下一章：[J7 並發](07-concurrency.md)
