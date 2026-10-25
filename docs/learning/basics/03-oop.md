# J3 物件導向

TypeScript 也有 class、interface，但 Java 是**徹底的物件導向**：所有程式碼都必須寫在 class 裡，沒有「檔案裡的普通函式」。

## 1. class 與物件

```java
public class Player {
    // 欄位（field）
    private final String name;
    private long points;

    // 建構子：名稱跟 class 一樣，沒有回傳型別
    public Player(String name, long points) {
        this.name = name;
        this.points = points;
    }

    // 建構子可以有好幾個，用 this(...) 呼叫另一個
    public Player(String name) {
        this(name, 10_000);
    }

    // 方法
    public void earn(long amount) {
        if (amount <= 0) {
            throw new IllegalArgumentException("amount must be positive");
        }
        this.points += amount;
    }

    public long getPoints() {
        return points;
    }
}

Player p = new Player("Rain");
p.earn(500);
p.getPoints();      // 10500
```

- 沒有寫任何建構子時，Java 會自動給一個「沒有參數的建構子」。**只要寫了一個，就不會自動給**
- `this` 指向目前的物件，跟 JS 一樣，但**不會因為呼叫方式不同而改變**（沒有 JS 的 `this` 綁定問題）

### 封裝：為什麼欄位要 `private` + getter

```java
p.points = -999;      // ❌ 如果 points 是 public，任何人都能改成不合理的值
p.earn(-999);         // ✅ 透過方法改，方法裡可以檢查
```

把欄位藏起來，只透過方法存取，**資料一定是合法的**。這就是封裝。TS 也有 `private`，概念一樣。

> 實務上：DTO 用 record（不可變，不需要 setter）；資料庫的 model 用 Lombok 產生 getter / setter；有業務規則的物件，自己寫有意義的方法（`earn`）而不是 `setPoints`。

## 2. static：屬於 class，不屬於物件

```java
public class Player {
    private static int count = 0;       // 所有 Player 共用一份
    private final String name;          // 每個 Player 各自一份

    public Player(String name) {
        this.name = name;
        count++;
    }

    public static int getCount() {      // 用 Player.getCount() 呼叫，不需要物件
        return count;
    }
}
```

| | instance（沒有 static） | static |
|---|---|---|
| 屬於 | 每個物件各一份 | 整個 class 一份 |
| 呼叫 | `player.getName()` | `Player.getCount()` |
| 能不能用 `this` | 可以 | **不行** |
| 常見用途 | 一般的方法和欄位 | 常數、工具方法（`Math.max`）、工廠方法（`List.of`） |

## 3. 繼承

```java
public class Animal {
    protected final String name;               // protected：子類別看得到

    public Animal(String name) {
        this.name = name;
    }

    public String speak() {
        return "...";
    }
}

public class Dog extends Animal {               // 繼承，≈ TS 的 extends
    public Dog(String name) {
        super(name);                            // 呼叫父類別的建構子，必須是第一行
    }

    @Override                                   // 標明「這是覆寫父類別的方法」
    public String speak() {
        return name + ": 汪";
    }
}
```

- Java **只能繼承一個 class**（單一繼承），但可以實作很多個 interface
- `@Override` 不是必須的，但**一定要加**：方法名稱打錯時，編譯器會告訴你「父類別沒有這個方法」，不然會默默變成一個新方法
- 所有 class 都繼承自 `Object`（≈ JS 的所有物件都有 `Object.prototype`）

### `final` 的三種用法

| 用在 | 意思 |
|---|---|
| 變數 | 不能重新指定 |
| 方法 | 子類別不能覆寫 |
| class | 不能被繼承（`String` 就是 `final class`） |

### 組合優於繼承

繼承讓子類別跟父類別綁得很緊，父類別一改，所有子類別都可能壞掉。**大部分情況用「組合」**：把別的物件當成欄位。

```java
// ❌ 為了重用程式碼而繼承
class BettingService extends WalletService { ... }

// ✅ 組合：BettingService 「有一個」WalletService
class BettingService {
    private final WalletService walletService;
}
```

30 Lab 裡的 Service 全部是組合（依賴注入就是組合）。只有在真的是「is-a」關係時才用繼承（`Dog` is an `Animal`）。

## 4. 抽象類別與介面

### 介面（interface）：規定「能做什麼」

```java
public interface PrizeRule {
    long prizeFor(int matched, boolean specialHit);      // 沒有實作，只有宣告

    default boolean isWinning(int matched, boolean specialHit) {   // default 方法：有預設實作
        return prizeFor(matched, specialHit) > 0;
    }

    static PrizeRule none() {                                       // static 方法
        return (m, s) -> 0;
    }
}

public class FixedPrizeRule implements PrizeRule {                  // 實作介面
    @Override
    public long prizeFor(int matched, boolean specialHit) { ... }
}
```

TS 的 interface 只在編譯時存在；**Java 的 interface 是真的型別**，執行時也在，可以有 `default` 和 `static` 方法。

### 抽象類別（abstract class）：部分實作

```java
public abstract class Notification {
    private final String to;
    protected Notification(String to) { this.to = to; }

    public final void send() {                  // 共用的流程
        String body = render();
        deliver(to, body);
    }

    protected abstract String render();         // 子類別一定要實作
    protected abstract void deliver(String to, String body);
}
```

| | interface | abstract class |
|---|---|---|
| 可以有欄位（狀態） | 只能有常數 | 可以 |
| 可以有建構子 | 不行 | 可以 |
| 一個 class 可以實作 / 繼承幾個 | 很多個 | 一個 |
| 什麼時候用 | **定義能力、規格**（大部分情況） | 好幾個子類別共用狀態和流程 |

**Spring 大量使用 interface**：`MongoRepository`、`PasswordEncoder`、`ApplicationRunner`、`ConstraintValidator`… 你寫的 class 實作這些介面，Spring 就知道怎麼呼叫它。

## 5. 多型

**同一個型別的變數，實際上可以是不同的物件，呼叫方法時執行的是實際物件的版本**：

```java
PasswordEncoder encoder = new BCryptPasswordEncoder();   // 宣告的型別是介面
encoder.encode("password123");                           // 執行的是 BCrypt 的實作

List<String> names = new ArrayList<>();                  // 宣告成介面，實際是 ArrayList
```

**依賴介面而不是具體的 class**，以後要換實作只改一個地方。30 Lab 的 `AuthService` 依賴的是 `PasswordEncoder`（介面），哪天要換成 Argon2，只改 `PasswordConfig` 一行。

### 轉型與 `instanceof`

```java
Animal a = new Dog("Lucky");
if (a instanceof Dog dog) {      // 是 Dog 的話，順便轉型成 dog 變數（Java 16+）
    dog.fetch();
}
Dog d = (Dog) a;                 // 強制轉型，型別不對會丟 ClassCastException
```

## 6. `Object` 的方法：`equals`、`hashCode`、`toString`

每個 class 都從 `Object` 繼承這三個方法，預設的行為通常不是你要的：

| 方法 | 預設行為 | 通常要改成 |
|---|---|---|
| `equals(Object o)` | 是不是**同一個物件**（跟 `==` 一樣） | 內容是否相同 |
| `hashCode()` | 根據記憶體位址算 | 根據參與 `equals` 的欄位算 |
| `toString()` | `Player@1b6d3586` | 好讀的內容 |

### `equals` 和 `hashCode` 的約定（面試必考）

> **兩個物件 `equals` 為 `true`，它們的 `hashCode` 一定要相同。**

為什麼？`HashMap`、`HashSet` 先用 `hashCode` 找到「桶子」，再用 `equals` 比較。只改 `equals` 不改 `hashCode`：

```java
class Point {
    final int x, y;
    Point(int x, int y) { this.x = x; this.y = y; }
    @Override public boolean equals(Object o) {
        return o instanceof Point p && p.x == x && p.y == y;
    }
    // 忘了覆寫 hashCode
}

Set<Point> set = new HashSet<>();
set.add(new Point(1, 2));
set.contains(new Point(1, 2));    // false！hashCode 不同，去錯的桶子找
```

**解法：用 record，或用 IntelliJ 產生**（`Alt + Insert` → equals() and hashCode()），或 Lombok `@EqualsAndHashCode`。**record 自動產生正確的三個方法**，這也是 DTO 用 record 的原因之一。

> ⚠️ 當 `HashMap` 的 key 或放進 `HashSet` 的物件，**放進去之後不能再改參與 `hashCode` 的欄位**，不然就找不到了。用不可變的物件（record、String）當 key 最安全。

## 7. record（Java 16+）

```java
public record Point(int x, int y) {
    public Point {                               // 精簡建構子：驗證或整理資料
        if (x < 0 || y < 0) throw new IllegalArgumentException("negative");
    }

    public double distance() {                   // 可以加方法
        return Math.sqrt(x * x + y * y);
    }

    public static Point origin() {               // 可以加 static 方法
        return new Point(0, 0);
    }
}
```

- 欄位全部是 `private final`，**不能有 setter**
- 自動產生建構子、讀取方法 `x()`、`equals`、`hashCode`、`toString`
- **不能繼承別的 class**（可以實作 interface）
- 適合：DTO、值物件、方法回傳多個值、Map 的 key

### 「淺」不可變

```java
record Team(String name, List<String> members) { }
Team t = new Team("A", new ArrayList<>(List.of("x")));
t.members().add("y");               // 可以！record 只保證 members 不能指向別的 List
```

要真正不可變，在精簡建構子裡複製一份：`members = List.copyOf(members);`

## 8. enum

```java
public enum Status {
    PENDING("待開獎"),
    WON("中獎"),
    LOST("沒中");

    private final String label;
    Status(String label) { this.label = label; }
    public String label() { return label; }

    public boolean isSettled() {
        return this != PENDING;
    }
}

Status s = Status.valueOf("WON");   // 字串 → enum，不存在丟 IllegalArgumentException
s.name();                           // "WON"
s.ordinal();                        // 1（宣告的位置，不要拿來存資料庫，順序一改就錯）
Status.values();                    // 全部
```

- enum 的每個值都是**單例物件**，可以用 `==` 比較
- 可以有欄位、方法、實作介面
- `EnumMap`、`EnumSet`：key 是 enum 時最快的集合（30 Lab 的 `SettlementService.summarize` 用了 `EnumMap`）

## 9. 巢狀類別、匿名類別

```java
public class Outer {
    // ① static 巢狀類別：跟外面的物件無關，最常用
    public static class Builder { ... }

    // ② 內部類別（沒有 static）：每個物件都綁著一個 Outer 物件，可以讀 Outer 的欄位
    class Inner { ... }

    // ③ 巢狀 record / enum / interface 自動是 static
    public record Result(int code) { }
}

// ④ 匿名類別：當場實作一個介面（Java 8 以前常見，現在大多用 lambda）
Comparator<String> byLength = new Comparator<>() {
    @Override
    public int compare(String a, String b) { return a.length() - b.length(); }
};
// 等於
Comparator<String> byLength2 = (a, b) -> a.length() - b.length();
```

**預設用 static 巢狀類別**；沒加 `static` 的內部類別會偷偷持有外部物件的參考，容易造成記憶體洩漏。

## 10. sealed（Java 17+）：限制誰能繼承

```java
public sealed interface BetSelection permits Single, Multiple, Banker { }
public record Single(List<List<Integer>> lines) implements BetSelection { }
public record Multiple(List<Integer> numbers) implements BetSelection { }
public record Banker(List<Integer> bankers, List<Integer> legs) implements BetSelection { }

// switch 知道只有這三種，少寫一個會編譯錯誤（≈ TS 的 discriminated union + never 檢查）
long lines = switch (selection) {
    case Single s -> s.lines().size();
    case Multiple m -> choose(m.numbers().size(), 6);
    case Banker b -> choose(b.legs().size(), 6 - b.bankers().size());
};
```

≈ TypeScript 的 `type BetSelection = Single | Multiple | Banker`。30 Lab 的三種玩法是用 enum + 一個 DTO 做的；用 sealed interface 是另一種更有型別保障的寫法。

## 11. 存取修飾子總整理

| 修飾子 | 同 class | 同 package | 子類別 | 所有人 |
|---|---|---|---|---|
| `private` | ✅ | | | |
| （不寫） | ✅ | ✅ | | |
| `protected` | ✅ | ✅ | ✅ | |
| `public` | ✅ | ✅ | ✅ | ✅ |

原則：**能用多小就用多小**。欄位一律 `private`；只給同 package 測試用的方法不寫修飾子。

---

## 常見錯誤

| 錯誤 | 原因 |
|---|---|
| `constructor X in class X cannot be applied to given types` | 寫了有參數的建構子後，Java 不再提供無參數建構子 |
| `call to super must be first statement` | `super(...)` 不在第一行 |
| `non-static variable cannot be referenced from a static context` | 在 static 方法裡用了 instance 欄位 |
| `method does not override or implement a method from a supertype` | 加了 `@Override` 但方法名稱或參數不對（這是好事，它幫你抓到錯了） |
| `HashSet` / `HashMap` 找不到明明放進去的東西 | 只覆寫了 `equals` 沒覆寫 `hashCode`，或放進去之後改了欄位 |
| `ClassCastException` | 強制轉型的型別不對 |

## 面試常問

- **物件導向的四個特性？** 封裝（隱藏資料、透過方法存取）、繼承（重用父類別）、多型（同一個型別、不同的實作）、抽象（只暴露必要的介面）
- **interface 和 abstract class 的差別？** 見第 4 節的表
- **overload 和 override 的差別？** overload 是同一個 class 裡同名不同參數（編譯時決定）；override 是子類別重新實作父類別的方法（執行時決定）
- **`equals` 和 `hashCode` 為什麼要一起覆寫？** 見第 6 節
- **為什麼用組合而不是繼承？** 繼承耦合太緊、只能單一繼承、父類別的改動會影響所有子類別；組合比較靈活，也容易測試
- **record 和一般 class 的差別？** record 不可變、自動產生建構子 / 讀取方法 / equals / hashCode / toString、不能繼承

## 小練習

1. 寫一個 `Point` class（不用 record），只覆寫 `equals`，放進 `HashSet` 後用 `contains` 檢查，重現第 6 節的問題；再用 IntelliJ 產生 `hashCode`，確認修好了
2. 把同一個 `Point` 改成 record，三行就做完同樣的事
3. 寫一個 `Shape` sealed interface，有 `Circle(double r)`、`Rect(double w, double h)` 兩個 record，用 switch 算面積

上一章：[J2 語言基礎](02-language-basics.md)　下一章：[J4 泛型與集合](04-generics-collections.md)
