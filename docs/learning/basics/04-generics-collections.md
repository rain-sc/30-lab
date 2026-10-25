# J4 泛型與集合

## 1. 泛型（Generics）

跟 TypeScript 的泛型幾乎一樣：

```java
// TS: function first<T>(list: T[]): T | undefined
public static <T> T first(List<T> list) {
    return list.isEmpty() ? null : list.get(0);
}

// TS: class Box<T> { constructor(public value: T) {} }
public class Box<T> {
    private final T value;
    public Box(T value) { this.value = value; }
    public T get() { return value; }
}

Box<String> box = new Box<>("hi");     // <> 讓編譯器推斷
```

### 限制型別範圍

```java
// TS: function max<T extends Comparable<T>>(a: T, b: T)
public static <T extends Comparable<T>> T max(T a, T b) {
    return a.compareTo(b) >= 0 ? a : b;
}
```

### 萬用字元 `?`

這是 TypeScript 沒有、Java 新手最困惑的地方。

```java
List<Integer> ints = List.of(1, 2, 3);
List<Number> nums = ints;          // ❌ 編譯錯誤！
```

`Integer` 是 `Number` 的子類別，但 **`List<Integer>` 不是 `List<Number>` 的子類別**。不然你可以 `nums.add(1.5)`，把一個 `Double` 放進 `List<Integer>` 裡。

用萬用字元解決：

| 寫法 | 意思 | 可以讀 | 可以寫 |
|---|---|---|---|
| `List<? extends Number>` | 某種 Number 的子類別的 List | ✅ 讀出來是 `Number` | ❌ |
| `List<? super Integer>` | 某種 Integer 的父類別的 List | 讀出來只是 `Object` | ✅ 可以放 `Integer` |
| `List<?>` | 任何型別的 List | 讀出來是 `Object` | ❌ |

```java
double sum(List<? extends Number> list) {      // 只讀：List<Integer>、List<Double> 都能傳進來
    double total = 0;
    for (Number n : list) total += n.doubleValue();
    return total;
}

void fill(List<? super Integer> list) {        // 只寫：List<Integer>、List<Number>、List<Object> 都可以
    list.add(42);
}
```

**記法 PECS**：**P**roducer **E**xtends, **C**onsumer **S**uper。只從裡面拿東西（生產者）用 `extends`；只往裡面放東西（消費者）用 `super`。

自己寫業務程式很少用到；看懂函式庫的簽名（例如 `Collections.sort(List<T> list, Comparator<? super T> c)`）時需要。

### 型別抹除

Java 的泛型**只在編譯時檢查**，編譯後 `List<String>` 和 `List<Integer>` 都變成 `List`（跟 TS 編譯成 JS 很像）。所以：

```java
new T();                                 // ❌ 不行，執行時不知道 T 是什麼
if (list instanceof List<String>) {}     // ❌ 不行
```

這就是為什麼 Spring 很多 API 要你多傳一個 `Class`：`mongoTemplate.findOne(query, Wallet.class)`。

## 2. 集合框架總覽

```
Collection
├── List      有順序、可以重複            ArrayList、LinkedList
├── Set       不能重複                    HashSet、LinkedHashSet、TreeSet
└── Queue     佇列                        ArrayDeque、PriorityQueue

Map           key → value（不是 Collection）  HashMap、LinkedHashMap、TreeMap
```

**宣告時用介面，建立時用實作**：`List<String> names = new ArrayList<>();`

### 怎麼選

| 需要 | 用 | JS 對照 |
|---|---|---|
| 一般的列表 | **`ArrayList`** | `Array` |
| 不重複、不在乎順序 | **`HashSet`** | `Set`（JS 的 Set 會保留插入順序） |
| 不重複、保留插入順序 | `LinkedHashSet` | `Set` |
| 不重複、自動排序 | `TreeSet` | — |
| key-value、不在乎順序 | **`HashMap`** | `Map` / 物件 |
| key-value、保留插入順序 | `LinkedHashMap` | `Map` |
| key-value、key 自動排序 | `TreeMap` | — |
| 堆疊 / 佇列 | `ArrayDeque` | `Array` 的 push / pop / shift |
| 優先佇列 | `PriorityQueue` | — |
| key 是 enum | `EnumMap` / `EnumSet` | — |
| 多執行緒同時讀寫 | `ConcurrentHashMap`（[J7](07-concurrency.md)） | — |

> ⚠️ **`HashMap` / `HashSet` 的順序是不固定的**。印出來看起來有順序只是巧合，不要依賴。需要順序用 `LinkedHashMap` / `LinkedHashSet` 或 `TreeMap`。

### 效能

| 操作 | `ArrayList` | `LinkedList` | `HashSet` / `HashMap` | `TreeSet` / `TreeMap` |
|---|---|---|---|---|
| 依索引取 | O(1) | O(n) | — | — |
| 加在尾端 | O(1) | O(1) | — | — |
| 查有沒有 | O(n) | O(n) | **O(1)** | O(log n) |
| 刪除中間 | O(n) | O(1)（找到之後） | O(1) | O(log n) |

**`LinkedList` 幾乎不用**：理論上插入快，實際上因為記憶體不連續，大部分情況比 `ArrayList` 慢。

**大量的 `list.contains(x)` 時，先轉成 `Set`**：

```java
Set<Integer> drawn = new HashSet<>(numbers);
line.stream().filter(drawn::contains).count();     // 每次 O(1)，而不是 O(6)
```

## 3. 建立集合

```java
// 不可變（Java 9+）：不能 add / remove / set，不能放 null
List<String> a = List.of("x", "y");
Set<Integer> b = Set.of(1, 2, 3);
Map<String, Integer> c = Map.of("a", 1, "b", 2);          // 最多 10 組
Map<String, Integer> d = Map.ofEntries(Map.entry("a", 1));
List<String> copy = List.copyOf(someList);                 // 不可變的複本

// 可變
List<String> list = new ArrayList<>();
List<String> list2 = new ArrayList<>(List.of("x", "y"));   // 從不可變的轉成可變的
Map<String, Integer> map = new HashMap<>();
```

| 寫法 | 能不能改 | 能不能放 null |
|---|---|---|
| `List.of(...)` | ❌（`UnsupportedOperationException`） | ❌ |
| `stream.toList()` | ❌ | ✅ |
| `Arrays.asList(...)` | **可以 `set`，不能 `add` / `remove`**（固定長度） | ✅ |
| `new ArrayList<>(...)` | ✅ | ✅ |
| `Collections.unmodifiableList(list)` | ❌，但**原本的 list 改了它也會跟著變**（只是唯讀的視窗） | ✅ |

> ⚠️ 方法回傳的 List 不知道能不能改時，**當成不能改**。要改就自己 `new ArrayList<>(...)` 複製一份。

## 4. List

```java
List<String> list = new ArrayList<>();
list.add("a");                    // ≈ push
list.add(0, "z");                 // 插入到最前面
list.get(0);                      // ≈ list[0]，超出範圍丟 IndexOutOfBoundsException
list.set(0, "y");                 // ≈ list[0] = "y"
list.remove(0);                   // 依索引刪
list.remove("a");                 // 依值刪（⚠️ List<Integer> 的 remove(1) 是刪索引 1，不是刪值 1）
list.size();                      // ≈ length
list.isEmpty();
list.contains("a");               // ≈ includes
list.indexOf("a");
list.subList(1, 3);               // ≈ slice(1, 3)，但是原 list 的「視窗」，不是複本
list.getFirst(); list.getLast();  // Java 21+
list.sort(Comparator.naturalOrder());
Collections.reverse(list);
Collections.shuffle(list);
```

### 迴圈中刪除元素

```java
for (String s : list) {
    if (s.isEmpty()) list.remove(s);        // 💥 ConcurrentModificationException
}

list.removeIf(String::isEmpty);             // ✅ 用 removeIf
```

## 5. Map

```java
Map<String, Integer> scores = new HashMap<>();
scores.put("rain", 10);                           // 新增或覆蓋
scores.get("rain");                               // 10；不存在回傳 null
scores.getOrDefault("x", 0);                      // ≈ map.get(x) ?? 0
scores.containsKey("rain");                       // ≈ has
scores.remove("rain");
scores.putIfAbsent("rain", 0);                    // 沒有才放

// 計數：≈ counts[k] = (counts[k] ?? 0) + 1
scores.merge("rain", 1, Integer::sum);

// 分組：≈ (groups[k] ??= []).push(v)
Map<String, List<String>> groups = new HashMap<>();
groups.computeIfAbsent("A", k -> new ArrayList<>()).add("x");

// 走訪
for (Map.Entry<String, Integer> e : scores.entrySet()) {
    e.getKey(); e.getValue();
}
scores.forEach((k, v) -> System.out.println(k + "=" + v));
scores.keySet(); scores.values();
```

## 6. 排序：`Comparable` 與 `Comparator`

```java
// Comparable：物件「天生」的順序（String、Integer、enum、Instant 都有）
List<String> names = new ArrayList<>(List.of("b", "a"));
Collections.sort(names);                       // ["a", "b"]

// Comparator：自己指定順序（≈ arr.sort((a, b) => ...)）
players.sort(Comparator.comparing(Player::getName));
players.sort(Comparator.comparingLong(Player::getPoints).reversed()
        .thenComparing(Player::getName));       // 積分由高到低，同分依名字
players.sort(Comparator.comparing(Player::getNickname, Comparator.nullsLast(Comparator.naturalOrder())));
```

`compareTo` / `compare` 的回傳值：負數 = 前面、0 = 一樣、正數 = 後面，跟 JS 的 sort 一樣。

> ⚠️ 不要寫 `(a, b) -> a.getPoints() - b.getPoints()` 比較 `long` / `int`：相減可能溢位，排出錯的順序。用 `Long.compare(a, b)` 或 `Comparator.comparingLong`。

## 7. Queue 與 Deque

```java
Deque<Integer> stack = new ArrayDeque<>();
stack.push(1); stack.push(2);
stack.pop();                 // 2（後進先出）

Queue<Integer> queue = new ArrayDeque<>();
queue.offer(1); queue.offer(2);
queue.poll();                // 1（先進先出），空的時候回傳 null

PriorityQueue<Integer> pq = new PriorityQueue<>();       // 最小的先出來
PriorityQueue<Integer> maxFirst = new PriorityQueue<>(Comparator.reverseOrder());
```

## 8. 工具類別

| 類別 | 常用方法 |
|---|---|
| `Collections` | `sort`、`reverse`、`shuffle`、`max`、`min`、`frequency`、`emptyList()`、`unmodifiableList` |
| `Arrays` | `asList`、`sort`、`toString`、`fill`、`stream` |
| `Objects` | `equals(a, b)`（處理 null）、`hash(...)`、`requireNonNull`、`isNull` / `nonNull` |

---

## 常見錯誤

| 錯誤 | 原因 |
|---|---|
| `UnsupportedOperationException` | 對 `List.of` / `toList()` / `Arrays.asList` 做了不支援的修改 |
| `ConcurrentModificationException` | for-each 迴圈裡改了 list（用 `removeIf` 或 iterator） |
| `NullPointerException`（在 `List.of(..., null)`、`Map.of` 時） | 不可變集合不接受 null |
| `incompatible types: List<Integer> cannot be converted to List<Number>` | 泛型不能這樣轉，用 `List<? extends Number>` |
| Map 拿到 null 拆箱 NPE | `int x = map.get(k);` key 不存在 |

## 面試常問

- **`ArrayList` 和 `LinkedList` 的差別？** 底層是陣列 vs 雙向鏈結；隨機存取 O(1) vs O(n)；實務上幾乎都用 ArrayList
- **`HashMap` 的原理？** 用 `hashCode` 算出放在哪個桶子，桶子裡用 `equals` 比較；碰撞時桶子是鏈結串列，太長（8 個以上）會轉成紅黑樹；容量到 75% 會擴充成兩倍
- **`HashMap` 和 `Hashtable` / `ConcurrentHashMap` 的差別？** HashMap 不是執行緒安全；Hashtable 是舊的、整個鎖住、很慢；ConcurrentHashMap 是現在多執行緒的標準選擇
- **`HashSet` 怎麼判斷重複？** 底層就是 `HashMap`，用 `hashCode` + `equals`
- **`Comparable` 和 `Comparator` 的差別？** Comparable 是物件自己實作的自然順序（`compareTo`）；Comparator 是外部定義的比較方式，可以有很多種

## 小練習

1. 在 jshell：`var l = List.of(1, 2); l.add(3);` 看錯誤訊息
2. `var l = new ArrayList<>(List.of(1, 2, 3)); l.remove(1); l` 結果是什麼？再試 `l.remove(Integer.valueOf(1))`
3. 用 `merge` 計算 `"banana"` 每個字母出現幾次
4. 有一個 `List<String>` 的暱稱，用 `Comparator` 依長度排，長度一樣的依字母排

上一章：[J3 物件導向](03-oop.md)　下一章：[J5 例外處理](05-exceptions.md)
