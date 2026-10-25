# S1 Spring Boot 全貌與自動設定

## 1. Spring 家族

「Spring」其實是一整個家族，新手常搞混：

| 名稱 | 是什麼 | 類比 |
|---|---|---|
| **Spring Framework** | 核心：IoC 容器、AOP、Web MVC、交易管理 | NestJS 的核心 |
| **Spring Boot** | 讓 Spring 開箱即用：自動設定、starter、內建伺服器、外部化設定 | Nest CLI + 預設設定 |
| Spring Data | 資料存取（JPA、MongoDB、Redis…），Repository 自動實作 | TypeORM / Prisma |
| Spring Security | 認證、授權 | Passport + Guards |
| Spring Cloud | 微服務：設定中心、服務發現、閘道 | — |
| Spring Batch | 大量資料的批次處理 | — |
| Spring AI | 接 LLM | — |

**沒有 Spring Boot 之前**，要寫一堆 XML 或設定類別：設定 DispatcherServlet、資料庫連線池、Jackson、交易管理器……，再把 war 檔部署到外部的 Tomcat。**Spring Boot** 的貢獻是：看你的 classpath 有什麼，自動幫你設好，打包成一個 jar 直接執行。

## 2. Starter

**starter = 一組常一起用的依賴**，加一個就把相關的套件和自動設定都帶進來：

| Starter | 帶進來什麼 |
|---|---|
| `spring-boot-starter-webmvc` | Spring MVC、內建 Tomcat、Jackson |
| `spring-boot-starter-webflux` | 非同步的 Web（Reactor、Netty），≈ Node 的模型 |
| `spring-boot-starter-data-jpa` | Hibernate、Spring Data JPA、HikariCP 連線池 |
| `spring-boot-starter-data-mongodb` | MongoDB driver、Spring Data MongoDB |
| `spring-boot-starter-data-redis` | Lettuce（Redis client）、Spring Data Redis |
| `spring-boot-starter-security` | Spring Security |
| `spring-boot-starter-validation` | Hibernate Validator（Bean Validation 的實作） |
| `spring-boot-starter-actuator` | 健康檢查、監控端點 |
| `spring-boot-starter-test` | JUnit 5、AssertJ、Mockito、Spring Test |

> Spring Boot 4 把很多功能拆成更小的模組，有些 starter 改了名字：`spring-boot-starter-web` → `spring-boot-starter-webmvc`、`spring-boot-starter-aop` → `spring-boot-starter-aspectj`；每個功能也有對應的 `*-test` starter（30 Lab 的 `pom.xml` 就是這樣）。看舊的教學時，名稱可能對不上。

## 3. 自動設定是怎麼運作的

這是 Spring Boot 最「魔法」的地方。其實原理很簡單：**一堆寫好的 `@Configuration` 類別，加上條件判斷**。

以 MongoDB 為例，Spring Boot 裡面有類似這樣的類別（簡化過）：

```java
@AutoConfiguration
@ConditionalOnClass(MongoClient.class)              // ① classpath 上有 MongoDB driver 才生效
@EnableConfigurationProperties(MongoProperties.class)   // ② 讀 spring.mongodb.* 設定
public class MongoAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean(MongoClient.class)    // ③ 你沒有自己定義 MongoClient 才建立
    public MongoClient mongo(MongoProperties properties) {
        return MongoClients.create(properties.getUri());
    }
}
```

1. 你加了 `spring-boot-starter-data-mongodb` → classpath 上有 `MongoClient` → 這個設定生效
2. 讀你的 `spring.mongodb.uri`
3. **你自己定義了同型別的 Bean，就用你的**；沒有才用預設的

**③ 是讓你能客製化的關鍵**：想換掉任何預設的東西，自己寫一個 `@Bean` 就好。30 Lab 的例子：

- `MongoConfig` 自己定義了 `MongoTransactionManager`（預設沒有，因為交易需要副本集）
- `SchedulingConfig` 自己定義了 `ThreadPoolTaskScheduler`（換掉預設的單執行緒）
- `PasswordConfig` 定義了 `PasswordEncoder`

### 常見的條件註解

| 註解 | 什麼時候生效 |
|---|---|
| `@ConditionalOnClass(X.class)` | classpath 上有 X |
| `@ConditionalOnMissingClass` | 沒有 |
| `@ConditionalOnBean(X.class)` | 容器裡已經有 X 這個 Bean |
| `@ConditionalOnMissingBean(X.class)` | 容器裡**沒有** X |
| `@ConditionalOnProperty(name = "a.b", havingValue = "true")` | 設定值符合（30 Lab 的排程開關） |
| `@ConditionalOnWebApplication` | 是 Web 程式 |
| `@Profile("dev")` | 某個 profile 啟用時 |

### 看哪些自動設定生效了

```powershell
.\mvnw.cmd spring-boot:run -Dspring-boot.run.arguments=--debug
```

啟動時會印出 **CONDITIONS EVALUATION REPORT**：

```
Positive matches:          ← 生效的
   DataMongoAutoConfiguration matched:
      - @ConditionalOnClass found required classes 'com.mongodb.client.MongoClient', ...
Negative matches:          ← 沒生效的，以及為什麼
   MongoReactiveAutoConfiguration:
      Did not match:
         - @ConditionalOnClass did not find required class 'com.mongodb.reactivestreams.client.MongoClient'
```

某個功能「應該自動設好卻沒有」時，看這份報告。

### 關掉某個自動設定

```java
@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)   // 30 Lab 的主程式
```

## 4. `@SpringBootApplication`

```java
@SpringBootApplication
public class App { public static void main(String[] args) { SpringApplication.run(App.class, args); } }
```

等於三個註解：

| 註解 | 作用 |
|---|---|
| `@SpringBootConfiguration` | 這個 class 是設定類別 |
| `@EnableAutoConfiguration` | 開啟自動設定 |
| `@ComponentScan` | 從**這個 class 所在的 package** 往下掃描 `@Component` |

> ⚠️ 主程式要放在**最上層的 package**（`com.thirtylab`）。放在 `com.thirtylab.app` 的話，`com.thirtylab.wallet` 底下的 class 都掃描不到，會出現「找不到 Bean」。

## 5. 設定的來源與優先順序

同一個設定可以從很多地方來，**優先順序高的會蓋掉低的**（簡化版，由高到低）：

1. **命令列參數**：`java -jar app.jar --server.port=9000`
2. `SPRING_APPLICATION_JSON` 環境變數
3. **作業系統的環境變數**：`SERVER_PORT=9000`
4. jar **外面**的 `application-{profile}.properties`
5. jar **外面**的 `application.properties`
6. jar **裡面**的 `application-{profile}.properties`
7. jar **裡面**的 `application.properties`
8. 程式裡的預設值

### 環境變數的名稱轉換（relaxed binding）

| 設定檔的寫法 | 環境變數 |
|---|---|
| `server.port` | `SERVER_PORT` |
| `spring.mongodb.uri` | `SPRING_MONGODB_URI` |
| `app.prize.jackpot-floor` | `APP_PRIZE_JACKPOTFLOOR` |

規則：`.` 換成 `_`、去掉 `-`、全部大寫。所以**不用在設定檔寫 `${...}`，環境變數也能直接蓋掉任何設定**。30 Lab 寫 `${MONGODB_URI:...}` 是為了讓環境變數的名字短一點。

### YAML

`application.properties` 也可以寫成 `application.yml`：

```yaml
server:
  port: 8088
app:
  prize:
    jackpot-floor: 500000
    second: 56000
  cors:
    allowed-origins:
      - http://localhost:3100
      - https://30-lab.vercel.app
```

效果一樣，看團隊習慣。YAML 的縮排錯了很難發現；properties 比較不容易出錯。

### Profile

```properties
spring.profiles.active=dev          # 設定檔裡指定（通常不這樣做）
```

```powershell
$env:SPRING_PROFILES_ACTIVE="prod"   # 環境變數指定（推薦）
java -jar app.jar --spring.profiles.active=prod,metrics   # 可以同時開好幾個
```

```java
@Configuration
@Profile("dev")                      // 只在 dev 時建立
public class DevDataSeeder { ... }
```

## 6. 啟動流程

```
SpringApplication.run()
 ├─ 準備 Environment：讀所有設定來源、決定 profile
 ├─ 印出 banner
 ├─ 建立 ApplicationContext（IoC 容器）
 ├─ 掃描 @Component、處理 @Configuration、套用自動設定 → 得到所有 Bean 的定義
 ├─ 依照依賴順序建立所有單例 Bean（建構子注入、@PostConstruct）
 ├─ 啟動內建的 Tomcat
 ├─ 發出 ApplicationReadyEvent 之前，執行所有 ApplicationRunner / CommandLineRunner
 └─ 開始接受請求；@Scheduled 開始排程
```

## 7. 內建伺服器

| | 傳統 Java EE | Spring Boot |
|---|---|---|
| 伺服器 | 另外安裝 Tomcat / WildFly | **內建在 jar 裡** |
| 部署 | 把 `.war` 丟進伺服器 | `java -jar app.jar` |
| 設定 | 伺服器的 XML | `server.*` 設定 |

常用的 `server.*` 設定：

```properties
server.port=8088
server.servlet.context-path=/api            # 所有路徑前面加 /api（30 Lab 沒用，路徑直接寫在 Controller）
server.shutdown=graceful                    # 關閉時等目前的請求處理完
server.tomcat.threads.max=200
spring.servlet.multipart.max-file-size=5MB  # 上傳檔案大小
```

## 8. DevTools

開發時改了程式碼、重新編譯後，**自動重啟**程式（只重新載入你的 class，比完整重啟快）。

> ⚠️ 30 Lab 踩過：DevTools 重啟時偶爾 `SecurityConfig` 沒載入，所有 API 都回 401。**看到奇怪的行為，先完整停止再啟動**。DevTools 在打包的 jar 裡會自動停用。

---

## 面試常問

- **Spring 和 Spring Boot 的差別？** Spring 是框架（IoC、AOP、MVC）；Spring Boot 是讓 Spring 快速上手的工具：自動設定、starter、內建伺服器、外部化設定
- **自動設定的原理？** `@EnableAutoConfiguration` 載入一堆 `@AutoConfiguration` 類別，每個用 `@Conditional...` 判斷要不要生效；使用者自己定義的 Bean 優先（`@ConditionalOnMissingBean`）
- **`@SpringBootApplication` 包含什麼？** `@SpringBootConfiguration`、`@EnableAutoConfiguration`、`@ComponentScan`
- **設定的優先順序？** 命令列 > 環境變數 > 外部設定檔 > jar 內的設定檔；profile 專屬的設定蓋掉一般的
- **怎麼換掉自動設定的元件？** 自己定義同型別的 `@Bean`，或用 `exclude`

## 小練習

1. 用 `--debug` 啟動 30 Lab，在報告裡找到 `DataMongoAutoConfiguration`（生效）和 `MongoReactiveAutoConfiguration`（不生效：沒有非同步版的 driver），看報告怎麼說明原因
2. 不改任何檔案，用環境變數把 `app.prize.seventh` 改成 30，啟動後打 `GET /api/game/rules` 確認（記得改回來）
3. 把 `ThirtyLabBackendApplication` 移到 `com.thirtylab.app` 會發生什麼？（想就好，不用真的做）

上一章：[J9 Maven](09-maven.md)　下一章：[S2 IoC 容器與 AOP](11-ioc-aop.md)
