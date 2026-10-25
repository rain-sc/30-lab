# Java / Spring Boot 新手基礎

[專案教程](../backend/README.md) 是「用 30 Lab 的程式碼學」，只講到這個專案用過的東西。這一套是**一般的基礎知識**：不管做什麼 Java 後端都會碰到、面試常問，但這個專案剛好沒用到（或只用了一點點）的部分。

寫法：

- 每個概念都先用 **TypeScript / Node / NestJS / PostgreSQL** 類比
- 範例是可以自己貼進 IntelliJ 跑的小程式（不依賴 30 Lab）；專案裡有用到的地方會註明「30 Lab 裡的例子」
- 每章最後有**常見錯誤**和**面試常問**

## 建議的讀法

1. 先讀 [專案教程](../backend/README.md) 的 01~05 章，對「一個 Spring Boot 專案長怎樣」有感覺
2. 再回來讀這裡的 **Java 篇**（J1~J9），補語言基礎
3. 然後讀 **Spring 篇**（S1~S6）
4. 最後用 [面試問答](16-interview-qa.md) 自我檢查

不用一次讀完。遇到看不懂的程式碼時，回來查對應的章節。

## Java 篇

| 章 | 主題 | 讀完你會懂 |
|---|---|---|
| [J1](01-jvm-and-runtime.md) | JDK、JVM 與執行環境 | Java 程式怎麼從 `.java` 變成在跑的程式；記憶體、GC；跟 Node 的差別 |
| [J2](02-language-basics.md) | 語言基礎 | 型別、運算子、字串、陣列、流程控制、方法、`null`；最常見的坑 |
| [J3](03-oop.md) | 物件導向 | class、繼承、介面、多型、`equals` / `hashCode`、record、enum、內部類別 |
| [J4](04-generics-collections.md) | 泛型與集合 | `List` / `Set` / `Map` 的各種實作怎麼選；泛型的萬用字元 |
| [J5](05-exceptions.md) | 例外處理 | checked / unchecked、try-with-resources、怎麼設計自己的例外 |
| [J6](06-functional-streams.md) | Lambda、Optional、Stream | 函式介面、Stream 的完整用法和陷阱 |
| [J7](07-concurrency.md) | 並發 | 執行緒、執行緒池、`CompletableFuture`、執行緒安全、虛擬執行緒 |
| [J8](08-time-and-modern-java.md) | 日期時間與新版 Java | `java.time` 全套；Java 17~21 的新語法 |
| [J9](09-maven.md) | Maven | `pom.xml`、依賴範圍、生命週期、常用指令；跟 npm 對照 |

## Spring 篇

| 章 | 主題 | 讀完你會懂 |
|---|---|---|
| [S1](10-spring-boot-overview.md) | Spring Boot 全貌與自動設定 | Spring 家族、starter、自動設定怎麼運作、設定的優先順序 |
| [S2](11-ioc-aop.md) | IoC 容器與 AOP 深入 | Bean 的作用域和生命週期、代理、AOP、事件 |
| [S3](12-web-mvc.md) | Web 開發深入 | 請求參數的各種寫法、狀態碼、Jackson、CORS、Filter / Interceptor、呼叫別的 API |
| [S4](13-data-jpa-transactions.md) | 資料存取與交易 | JPA / Hibernate（對照 PostgreSQL）、N+1、資料庫遷移、`@Transactional` 的所有細節 |
| [S5](14-testing.md) | 測試 | JUnit 5、Mockito、測試切片、MockMvc、Testcontainers |
| [S6](15-security-and-ops.md) | 安全與上線 | Spring Security 概念、日誌、Actuator、打包部署、JVM 記憶體 |
| [Q](16-interview-qa.md) | 面試問答 | 常見題目和回答方向 |

## 版本說明

這個專案用 **Java 21**、**Spring Boot 4.1**（底層是 Spring Framework 7）。網路上的教學很多還是 Java 8 / Spring Boot 2 的寫法，看到下面這些就知道是舊的：

| 舊寫法 | 現在的寫法 | 原因 |
|---|---|---|
| `import javax.persistence.*`、`javax.validation.*` | `jakarta.persistence.*`、`jakarta.validation.*` | Spring Boot 3 起改用 Jakarta EE 的套件名稱 |
| `WebSecurityConfigurerAdapter` | `@Bean SecurityFilterChain` | Spring Security 6 移除了舊的繼承寫法 |
| `RestTemplate` | `RestClient` | 新的同步 HTTP client，API 比較好用 |
| `@MockBean` | `@MockitoBean` | Boot 3.4 起標為淘汰，Boot 4 移除 |
| `new Date()`、`SimpleDateFormat` | `Instant`、`LocalDate`、`DateTimeFormatter` | Java 8 的 `java.time` 取代了舊的日期類別 |
| 一堆 getter / setter 的 DTO | `record` | Java 16 起有 record |
| `com.fasterxml.jackson.databind.*` | `tools.jackson.databind.*` | Spring Boot 4 改用 Jackson 3；**註解**（`@JsonIgnore` 等）還是 `com.fasterxml.jackson.annotation` |
