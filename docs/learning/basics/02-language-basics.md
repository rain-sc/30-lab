# J2 語言基礎

[專案教程第 2 章](../backend/02-java-for-ts.md) 講了專案裡用到的語法。這一章補完整：每個基本概念、以及新手最常踩的坑。

## 1. 基本型別（primitive types）

Java 有 8 種基本型別，**不是物件**、不能是 `null`、有固定的大小：

| 型別 | 大小 | 範圍 | 預設值 | 用途 |
|---|---|---|---|---|
| `byte` | 8 位元 | -128 ~ 127 | `0` | 二進位資料 |
| `short` | 16 位元 | -32,768 ~ 32,767 | `0` | 很少用 |
| `int` | 32 位元 | 約 ±21 億 | `0` | **一般整數** |
| `long` | 64 位元 | 約 ±922 京 | `0L` | 大整數、時間戳、**錢** |
| `float` | 32 位元 | 約 7 位有效數字 | `0.0f` | 很少用 |
| `double` | 64 位元 | 約 15 位有效數字 | `0.0` | 一般小數（**不能用在錢**） |
| `char` | 16 位元 | 一個 UTF-16 字元 | `'\u0000'` | 單一字元，用單引號 `'A'` |
| `boolean` | — | `true` / `false` | `false` | |

TypeScript 只有一個 `number`（其實是 64 位元浮點數，等於 Java 的 `double`）。

### 溢位：不會報錯，默默變錯

```java
int max = Integer.MAX_VALUE;     // 2,147,483,647
int boom = max + 1;              // -2,147,483,648（繞回最小值），不會有任何錯誤
long ok = (long) max + 1;        // 2,147,483,648：先轉成 long 再加
Math.addExact(max, 1);           // 丟 ArithmeticException：想要「溢位就報錯」用這個
```

> 常見 bug：`int` 算毫秒。`int ms = days * 24 * 60 * 60 * 1000;` 超過 24 天就溢位。時間戳一律用 `long`。

### 小數不精確：錢不能用 `double`

```java
System.out.println(0.1 + 0.2);         // 0.30000000000000004（跟 JS 一樣）
```

| 做法 | 什麼時候用 |
|---|---|
| **用整數存最小單位** | 30 Lab：積分本來就是整數，`long`；真實的錢可以存「分」 |
| `BigDecimal` | 需要小數的金額（利率、匯率） |

```java
BigDecimal price = new BigDecimal("19.99");          // ⚠️ 用字串建立，不要用 new BigDecimal(19.99)
BigDecimal total = price.multiply(BigDecimal.valueOf(3)).setScale(2, RoundingMode.HALF_UP);
price.equals(new BigDecimal("19.990"));              // false！equals 會比較小數位數
price.compareTo(new BigDecimal("19.990")) == 0;      // true：比較大小要用 compareTo
```

### 型別轉換

```java
int i = 10;
long l = i;                 // 小 → 大：自動轉換
int back = (int) l;         // 大 → 小：要強制轉換，超出範圍會截斷
double d = 9.99;
int truncated = (int) d;    // 9：直接捨去，不是四捨五入
long rounded = Math.round(d);   // 10

int n = Integer.parseInt("42");        // 字串 → 數字（≈ Number("42")），格式錯丟 NumberFormatException
String s = String.valueOf(42);         // 數字 → 字串
```

## 2. 包裝型別與自動裝箱

每個基本型別都有一個對應的**物件**版本：`Integer`、`Long`、`Double`、`Boolean`、`Character`…

- 集合只能放物件：`List<Integer>`，不能 `List<int>`
- 可以是 `null`

Java 會自動轉換（**自動裝箱 / 拆箱**）：

```java
List<Integer> list = new ArrayList<>();
list.add(5);                // int 5 自動裝箱成 Integer.valueOf(5)
int first = list.get(0);    // Integer 自動拆箱成 int
```

### 坑 1：拆箱遇到 `null` → `NullPointerException`

```java
Integer maybe = map.get("missing");   // null
int value = maybe;                    // 💥 NullPointerException：null 不能拆成 int
```

### 坑 2：用 `==` 比較包裝型別

```java
Integer a = 127, b = 127;
a == b;            // true
Integer c = 128, d = 128;
c == d;            // false！
c.equals(d);       // true
```

`Integer.valueOf` 會快取 -128 ~ 127 的物件，所以小數字剛好是同一個物件，`==` 為 `true`；128 以上是不同的物件，`==` 比的是「是不是同一個物件」，所以是 `false`。**包裝型別一律用 `equals` 比較**。這種 bug 很難發現，因為測試時用的小數字都會過。

## 3. 運算子

大部分跟 JavaScript 一樣，差別在這裡：

| 運算 | Java | JavaScript |
|---|---|---|
| 整數除法 | `7 / 2` = **`3`**（兩邊都是整數就捨去小數） | `3.5` |
| 小數除法 | `7 / 2.0` = `3.5` | `3.5` |
| 取餘數 | `-7 % 3` = `-1` | `-1` |
| 相等 | `==`（基本型別比值、物件比是不是同一個） | `===` |
| 物件內容相等 | `a.equals(b)` | 自己寫 / lodash `isEqual` |
| 字串串接 | `"a" + 1 + 2` = `"a12"`、`1 + 2 + "a"` = `"3a"` | 一樣 |
| 三元運算子 | `cond ? a : b` | 一樣 |
| 沒有的 | `===`、`??`、`?.`、`**`（次方用 `Math.pow`） | |

**沒有 truthy / falsy**：`if (count)` 編譯錯誤，要寫 `if (count > 0)`；`if (str)` 要寫 `if (str != null && !str.isEmpty())`。

## 4. 字串

### 字串是不可變的

```java
String s = "hello";
s.toUpperCase();         // 回傳新的字串 "HELLO"，s 還是 "hello"
s = s.toUpperCase();     // 要接回來
```

跟 JavaScript 一樣。

### 在迴圈裡串接用 `StringBuilder`

```java
String result = "";
for (int i = 0; i < 10000; i++) {
    result += i;              // ❌ 每次都建立一個新字串，O(n²)
}

StringBuilder sb = new StringBuilder();
for (int i = 0; i < 10000; i++) {
    sb.append(i).append(',');     // ✅ 在同一個 buffer 裡加
}
String result = sb.toString();
```

一般的 `a + b + c` 不用擔心，編譯器會自動優化。

### 常用方法

| Java | JavaScript |
|---|---|
| `s.length()` | `s.length` |
| `s.charAt(0)` | `s[0]` |
| `s.substring(1, 3)` | `s.substring(1, 3)` |
| `s.indexOf("x")` / `s.contains("x")` | `s.indexOf("x")` / `s.includes("x")` |
| `s.startsWith("a")` / `s.endsWith("z")` | 一樣 |
| `s.strip()`（處理 Unicode 空白）/ `s.trim()` | `s.trim()` |
| `s.isEmpty()` / `s.isBlank()`（只有空白也算） | `s === ""` / `s.trim() === ""` |
| `s.split(",")`（參數是**正規表達式**） | `s.split(",")` |
| `String.join(",", list)` | `list.join(",")` |
| `s.replace("a", "b")`（全部取代） | `s.replaceAll("a", "b")` |
| `s.equalsIgnoreCase(t)` | `s.toLowerCase() === t.toLowerCase()` |
| `"%s 有 %d 分".formatted(name, score)` | `` `${name} 有 ${score} 分` `` |
| `"ab".repeat(3)` | `"ab".repeat(3)` |

> ⚠️ `"a.b.c".split(".")` 回傳空陣列，因為 `.` 在正規表達式是「任何字元」。要寫 `split("\\.")`。

## 5. 陣列

Java 的陣列**長度固定**，建立後不能增減：

```java
int[] nums = new int[5];              // [0, 0, 0, 0, 0]
int[] primes = {2, 3, 5, 7};
nums[0] = 10;
nums.length;                          // 5（是屬性，不是方法）
nums[5] = 1;                          // 💥 ArrayIndexOutOfBoundsException（JS 會默默給 undefined）

Arrays.toString(primes);              // "[2, 3, 5, 7]"（直接印陣列會印出 [I@1b6d3586 這種位址）
Arrays.sort(primes);
int[][] grid = new int[3][4];         // 二維陣列
```

**實務上大部分時候用 `List`**（[J4](04-generics-collections.md)），陣列只在效能敏感或 API 要求時用。`main(String[] args)` 是少數一定會看到陣列的地方。

## 6. 流程控制

```java
// if / else：跟 JS 一樣，但條件一定要是 boolean
if (score >= 90) { ... } else if (score >= 60) { ... } else { ... }

// for
for (int i = 0; i < 10; i++) { ... }
for (String name : names) { ... }          // ≈ for (const name of names)

// while / do-while
while (running) { ... }
do { ... } while (retry);

// 跳出外層迴圈
outer:
for (int i = 0; i < 3; i++) {
    for (int j = 0; j < 3; j++) {
        if (j == 2) continue outer;        // 直接進到外層的下一輪
        if (i == 2) break outer;           // 直接跳出兩層
    }
}
```

### switch 的兩種寫法

```java
// 舊寫法：要 break，忘了寫會「掉下去」執行下一個 case
switch (day) {
    case "SAT":
    case "SUN":
        type = "週末";
        break;
    default:
        type = "平日";
}

// 新寫法（Java 14+）：箭頭、不用 break、可以回傳值
String type = switch (day) {
    case "SAT", "SUN" -> "週末";
    default -> "平日";
};
```

**新的程式一律用箭頭寫法**。

## 7. 方法

### 多載（overloading）：同名、不同參數

```java
public static int add(int a, int b) { return a + b; }
public static double add(double a, double b) { return a + b; }
public static int add(int a, int b, int c) { return a + b + c; }
```

TypeScript 要用聯合型別或 overload 宣告；Java 可以直接寫多個同名方法，編譯器依參數型別選。

### 沒有預設參數

```java
// TS: function greet(name: string, greeting = "Hi")
// Java：用多載模擬
public String greet(String name) { return greet(name, "Hi"); }
public String greet(String name, String greeting) { return greeting + " " + name; }
```

### 可變參數

```java
public static int sum(int... nums) {         // ≈ (...nums: number[])
    int total = 0;
    for (int n : nums) total += n;
    return total;
}
sum(1, 2, 3);
```

### Java 永遠是「傳值」

跟 JavaScript 一樣：

```java
void change(int x, List<Integer> list, StringBuilder sb) {
    x = 100;                    // 改的是 x 的副本，外面不受影響
    list.add(1);                // 透過參考改物件內容 → 外面看得到
    sb = new StringBuilder();   // 只是讓區域變數指向新物件，外面的 sb 不受影響
}
```

物件傳進方法時，傳的是「參考的副本」，可以改物件的內容，但不能讓外面的變數指向別的物件。

## 8. `null` 與 `NullPointerException`

Java 只有 `null`，沒有 `undefined`。對 `null` 呼叫任何方法就會 `NullPointerException`（NPE），這是 Java 最常見的錯誤。

```java
String name = null;
name.length();         // 💥 NullPointerException
```

Java 14 起的錯誤訊息會告訴你是哪個變數：`Cannot invoke "String.length()" because "name" is null`。

### 怎麼避免

| 做法 | 例子 |
|---|---|
| 不回傳 `null` 的集合，回傳空集合 | `return List.of();` |
| 可能找不到的回傳 `Optional` | `Optional<User> findById(...)`（[J6](06-functional-streams.md)） |
| 用基本型別表示一定有值 | `long balance`（不是 `Long`） |
| 常數放前面比較 | `"ADMIN".equals(role)`（`role` 是 null 也不會 NPE） |
| 參數檢查 | `Objects.requireNonNull(user, "user")` |
| 驗證外部輸入 | DTO 加 `@NotNull` |

## 9. 變數與常數

```java
int count = 0;                      // 一般變數
final int max = 10;                 // 設定後不能再改（≈ const）
var list = new ArrayList<String>(); // 讓編譯器推斷型別（只能用在區域變數）
static final int MAX_LINES = 50;    // class 層級的常數，慣例全大寫 + 底線
```

**`final` 只保證變數不能指向別的東西，不保證物件內容不變**（跟 JS 的 `const` 一樣）：

```java
final List<String> names = new ArrayList<>();
names.add("Rain");                  // ✅ 可以
names = new ArrayList<>();          // ❌ 編譯錯誤
```

### 命名慣例

| 東西 | 慣例 | 例子 |
|---|---|---|
| class、interface、enum、record | PascalCase | `WalletService` |
| 方法、變數 | camelCase | `getBalance`、`userId` |
| 常數 | UPPER_SNAKE_CASE | `MAX_ATTEMPTS` |
| package | 全小寫、反過來的網域 | `com.thirtylab.wallet` |
| boolean 的 getter | `is` 開頭 | `isEnabled()` |

---

## 常見錯誤

| 錯誤 | 原因 |
|---|---|
| `incompatible types: possible lossy conversion from long to int` | 大 → 小沒有強制轉換 |
| `NumberFormatException` | `Integer.parseInt("abc")` |
| `ArrayIndexOutOfBoundsException` / `IndexOutOfBoundsException` | 索引超出範圍 |
| 數字莫名變成負的 | `int` 溢位 |
| 兩個一樣的數字 `==` 卻是 `false` | 包裝型別用了 `==` |
| `incomparable types` / 條件不是 boolean | 寫了 `if (count)` |

## 面試常問

- **基本型別和包裝型別的差別？** 基本型別存值、不能是 null、效能好；包裝型別是物件、可以是 null、可以放進集合。注意自動拆箱的 NPE 和 `==` 的快取問題
- **`==` 和 `equals` 的差別？** `==` 對物件比較是不是同一個物件（記憶體位址），`equals` 比較內容（要 class 自己實作）
- **String 為什麼是不可變的？** 安全（當 HashMap 的 key 不會被改）、可以共用（字串常數池）、執行緒安全
- **`String`、`StringBuilder`、`StringBuffer` 的差別？** String 不可變；StringBuilder 可變、不是執行緒安全、快；StringBuffer 可變、執行緒安全（方法有 synchronized）、比較慢，現在很少用
- **Java 是傳值還是傳參考？** 永遠是傳值；物件傳的是參考的副本

## 小練習

在 `jshell` 裡試：

1. `Integer.MAX_VALUE + 1`
2. `7 / 2`、`7 / 2.0`、`(double) 7 / 2`
3. `Integer a = 1000, b = 1000; a == b`，再試 `a.equals(b)`
4. `"a,b,,c".split(",")` 的長度是多少？`"a.b".split(".")` 呢？
5. `new BigDecimal("1.10").equals(new BigDecimal("1.1"))`

上一章：[J1 JVM](01-jvm-and-runtime.md)　下一章：[J3 物件導向](03-oop.md)
