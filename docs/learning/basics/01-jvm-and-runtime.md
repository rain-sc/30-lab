# J1 JDK、JVM 與執行環境

## 1. Java 程式是怎麼跑起來的

TypeScript 是「先編譯成 JavaScript，再由 Node（V8 引擎）執行」。Java 很像，只是中間產物不是 JS，而是 **bytecode（位元組碼）**：

```
TypeScript:  hello.ts  ──tsc──▶  hello.js  ──node──▶  V8 引擎執行（JIT 編譯成機器碼）
Java:        Hello.java ──javac──▶ Hello.class ──java──▶ JVM 執行（JIT 編譯成機器碼）
                                   （bytecode）
```

| 名詞 | 是什麼 | Node 對照 |
|---|---|---|
| **JVM**（Java Virtual Machine） | 執行 bytecode 的虛擬機器 | V8 引擎 |
| **JRE**（Java Runtime Environment） | JVM + 標準函式庫，**只能執行** | Node 執行環境 |
| **JDK**（Java Development Kit） | JRE + 編譯器 `javac` + 工具（`jar`、`jshell`…），**開發要裝這個** | Node + `tsc` + npm |
| bytecode（`.class` 檔） | 編譯後的中間碼，跟作業系統無關 | 編譯後的 `.js` |
| JIT（Just-In-Time） | 執行時把常跑的 bytecode 編譯成機器碼 | V8 的 TurboFan |

**「Write once, run anywhere」**：同一份 `.class` 在 Windows、Linux、Mac 的 JVM 上都能跑。所以 30 Lab 的後端在你的 Windows 開發，部署到 Render 的 Linux 容器不用重新寫任何東西。

### 自己試一次（不用 IntelliJ）

```java
// Hello.java
public class Hello {
    public static void main(String[] args) {
        System.out.println("Hello " + args[0]);
    }
}
```

```powershell
javac Hello.java        # 產生 Hello.class
java Hello Rain         # 執行，印出 Hello Rain
java Hello.java Rain    # Java 11 起可以直接執行單一原始檔（不產生 .class），適合小實驗
jshell                  # 互動式命令列（≈ 打 node 進入 REPL），試語法很方便
```

- `main` 方法是程式進入點，固定寫法 `public static void main(String[] args)`
- `args` ≈ Node 的 `process.argv.slice(2)`
- `System.out.println` ≈ `console.log`

## 2. classpath 與 jar

### classpath：JVM 去哪裡找 class

Node 用 `node_modules` 資料夾找套件；JVM 用 **classpath**（一串資料夾和 jar 檔的清單）找 class。

```powershell
java -cp "target/classes;lib/jjwt-api.jar;lib/..." com.thirtylab.ThirtyLabBackendApplication
```

你幾乎不用自己設：Maven 和 IntelliJ 會依照 `pom.xml` 組好 classpath。但看到這兩種錯誤要知道是 classpath 的問題：

| 錯誤 | 意思 |
|---|---|
| `ClassNotFoundException` | 執行時找不到某個 class（少了依賴、打包時沒包進去） |
| `NoClassDefFoundError` | 編譯時有，執行時沒有（常見於依賴版本衝突） |
| `NoSuchMethodError` | 找到 class 了但沒有那個方法：**兩個依賴要求同一個套件的不同版本**，實際載入的是不相容的那個 |

### jar：打包好的 class

**jar（Java ARchive）就是一個 zip 檔**，裡面是 `.class` 和資源檔。可以用解壓縮軟體打開看。

- 一般的 jar：一個函式庫（≈ 一個 npm 套件）
- **Spring Boot 的「fat jar」**：把你的程式 + 所有依賴 + 內建的 Tomcat 全部包成一個 jar，`java -jar app.jar` 就能跑。30 Lab 的 `Dockerfile` 就是這樣做的

```powershell
cd backend
.\mvnw.cmd package -DskipTests              # 產生 target/30-lab-backend-0.0.1-SNAPSHOT.jar
java -jar target/30-lab-backend-0.0.1-SNAPSHOT.jar
```

≈ Node 沒有這種東西，最接近的是把 `dist/` 和 `node_modules/` 一起打包成 Docker image。

## 3. Java 的版本

Java 每半年出一個版本，每兩年一個 **LTS（長期支援）** 版本。公司一般只用 LTS：

| 版本 | 年份 | 重要的新東西 |
|---|---|---|
| **8** (LTS) | 2014 | Lambda、Stream、`Optional`、`java.time`。很多舊系統還停在這版 |
| **11** (LTS) | 2018 | `var`（10）、`HttpClient`、直接執行 `.java` 檔 |
| **17** (LTS) | 2021 | `record`、`sealed`、text block `"""`、switch 運算式、`instanceof` 模式比對。**Spring Boot 3 的最低版本** |
| **21** (LTS) | 2023 | **虛擬執行緒**、switch 模式比對、record 模式、`getFirst()` / `getLast()`。**30 Lab 用這版** |
| 25 (LTS) | 2025 | |

各版本的語法在 [J8](08-time-and-modern-java.md) 詳細介紹。

`pom.xml` 裡的 `<java.version>21</java.version>` 決定用哪一版編譯。IntelliJ 的 File → Project Structure → SDK 要選對應的 JDK。

## 4. 記憶體：Stack 與 Heap

| 區域 | 放什麼 | 特性 |
|---|---|---|
| **Stack（堆疊）** | 方法的區域變數、參數；基本型別（`int`、`long`）的值；**物件的參考（地址）** | 每條執行緒一個，方法結束就自動清掉，很快 |
| **Heap（堆積）** | **所有 `new` 出來的物件**（字串、List、你的 class…） | 所有執行緒共用，由 GC 回收 |

```java
void example() {
    int count = 5;                    // count 的值 5 在 stack
    String name = "Rain";             // name 這個「參考」在 stack，"Rain" 字串物件在 heap
    List<Integer> nums = new ArrayList<>();   // 參考在 stack，ArrayList 物件在 heap
}   // 方法結束：stack 上的 count、name、nums 消失；heap 上的物件沒人參考了，等 GC 回收
```

JavaScript 其實一樣（物件都在 heap），只是平常不用想。Java 需要懂，因為：

- **`StackOverflowError`**：遞迴太深，stack 用完了（≈ JS 的 `Maximum call stack size exceeded`）
- **`OutOfMemoryError: Java heap space`**：heap 用完了（物件太多、太大，或記憶體洩漏）

## 5. 垃圾回收（GC）

跟 JavaScript 一樣，Java **不用自己 free 記憶體**。沒有任何地方參考的物件，GC 會自動回收。

```java
List<String> list = new ArrayList<>();
list = null;          // 原本的 ArrayList 沒人參考了 → 之後會被 GC 回收
```

**Java 也會記憶體洩漏**：物件還被參考著，GC 就不能回收。最常見的情況：

```java
public class Cache {
    private static final Map<String, Object> CACHE = new HashMap<>();   // static：整個程式執行期間都在
    public void put(String key, Object value) {
        CACHE.put(key, value);     // 只放不刪 → 越來越大 → 最後 OutOfMemoryError
    }
}
```

≈ JS 裡在全域變數一直塞東西。解法：設上限、設過期時間，或用現成的快取（Caffeine、Redis）。

### GC 會暫停程式

GC 回收時，可能要短暫暫停所有執行緒（Stop-The-World）。現代的 GC（Java 21 預設的 G1、低延遲的 ZGC）把暫停控制在幾毫秒，一般網站感覺不到。

## 6. JVM 的記憶體設定

```powershell
java -Xms256m -Xmx512m -jar app.jar                # heap 最小 256 MB、最大 512 MB
java -XX:MaxRAMPercentage=60.0 -jar app.jar        # heap 最多用容器記憶體的 60%（容器裡推薦這樣設）
```

| 參數 | 意思 |
|---|---|
| `-Xmx` | heap 上限。超過就 `OutOfMemoryError` |
| `-Xms` | heap 初始大小 |
| `-XX:MaxRAMPercentage` | 用百分比設 heap 上限，配合 Docker 的記憶體限制 |
| `-XX:+ExitOnOutOfMemoryError` | OOM 時直接結束程式，讓 Docker / Render 重啟它（而不是半死不活地繼續跑） |

**為什麼 heap 不設成 100%？** JVM 除了 heap 還要記憶體：每條執行緒的 stack、已載入的 class（Metaspace）、JIT 編譯結果、網路 buffer。30 Lab 部署到 Render 免費方案（512 MB）時，heap 只給六成（`backend/Dockerfile`）。

> Spring Boot 程式啟動後大約用 200~400 MB，比同樣功能的 Node 程式多。這是 JVM 的代價：換來的是多執行緒、成熟的 JIT、穩定的長時間執行效能。

## 7. 跟 Node 的根本差別

| | Node | Java |
|---|---|---|
| 執行緒 | **一條**主執行緒 + 事件迴圈；I/O 是非同步的 | **很多條**執行緒同時跑；I/O 預設是同步（阻塞）的 |
| 處理很多請求 | 一條執行緒輪流處理，等 I/O 時去做別的 | 每個請求一條執行緒（Tomcat 預設最多 200 條），等 I/O 時那條執行緒就停著 |
| 寫法 | 到處 `async` / `await` | 直接寫同步的程式碼，`repository.findById(id)` 會等到結果回來 |
| 共享資料 | 不用擔心同時修改（只有一條執行緒） | **要擔心**：兩條執行緒同時改同一個物件會出錯（[J7](07-concurrency.md)） |
| 啟動 | 快（毫秒） | 慢（Spring Boot 幾秒），但之後跑得很穩 |
| 型別 | TS 的型別編譯後就消失 | Java 的型別**執行時還在**（反射可以讀到），框架靠這個做很多自動化 |

**為什麼 Java 不用寫 `await`？** 因為每個請求有自己的執行緒，那條執行緒停下來等資料庫，不會卡住別的請求。代價是執行緒很貴（每條約 1 MB stack），所以同時能處理的請求數有上限。Java 21 的**虛擬執行緒**解決了這個問題（[J7](07-concurrency.md)）。

---

## 常見錯誤

| 錯誤 | 原因 |
|---|---|
| `'javac' 不是內部或外部命令` | 只裝了 JRE，或 JDK 的 `bin` 沒加到 PATH |
| `UnsupportedClassVersionError ... class file version 65.0` | 用 Java 21 編譯（65 = Java 21），但用比較舊的 Java 執行。IntelliJ 的 SDK、`JAVA_HOME`、Docker 的基底 image 版本要一致 |
| `OutOfMemoryError: Java heap space` | heap 不夠，或記憶體洩漏 |
| `StackOverflowError` | 遞迴沒有正確結束 |

## 面試常問

- **JDK、JRE、JVM 的差別？** JVM 執行 bytecode；JRE = JVM + 標準函式庫；JDK = JRE + 開發工具
- **Java 為什麼能跨平台？** 編譯成跟平台無關的 bytecode，每個平台有自己的 JVM
- **Stack 和 Heap 的差別？** Stack 放區域變數和參考，每條執行緒一個，自動清除；Heap 放物件，所有執行緒共用，由 GC 回收
- **Java 會不會記憶體洩漏？** 會。物件一直被參考（例如 static 集合只放不刪），GC 就不能回收

## 小練習

1. 用 `jshell` 打 `1 + 1`、`"abc".length()`、`List.of(1, 2, 3)`，感受一下。輸入 `/exit` 離開
2. 執行 `.\mvnw.cmd package -DskipTests`，用解壓縮軟體打開產生的 jar，找到 `BOOT-INF/classes/`（你的程式）和 `BOOT-INF/lib/`（所有依賴）
3. 打開 `backend/Dockerfile`，找出它用的是 JDK 還是 JRE 的 image，各在哪個階段用？為什麼？

下一章：[J2 語言基礎](02-language-basics.md)
