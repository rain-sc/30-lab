# 01 全貌：後端在做什麼、啟動時發生什麼

## 1. 後端的工作，用前端的角度看

你在前端按下「下注」時，前端做的事是：

```ts
await api.post('/api/tickets', { drawNo, idempotencyKey, lines })
```

**後端就是這個網址另一頭的程式**。它負責：

| 工作 | 為什麼不能放在前端 |
|---|---|
| 檢查你是誰（登入） | 前端的程式碼使用者都看得到、改得了 |
| 檢查資料合不合法（號碼 1~30、不能重複） | 使用者可以繞過前端，直接用 Postman 送任何東西 |
| 扣積分、建注單 | 錢的事情一定要在伺服器上做，而且要保證不會扣兩次 |
| 每 5 分鐘開獎、結算派彩 | 就算沒有人開著網頁，這些事也要準時發生 |
| 推播開獎結果 | 讓所有人的畫面同時更新 |

一句話：**前端負責「顯示」和「收集輸入」，後端負責「規則」和「資料」**。

## 2. 整個系統長怎樣

```
瀏覽器 ──HTTP /api/*──▶ Next.js（:3100）──轉發──▶ Spring Boot（:8088）──▶ MongoDB（:27018）
   │                                                    │
   └────────── WebSocket ws://:8088/ws（直連）──────────┘──▶ Redis（:6380）
```

- **Next.js** 只是把 `/api/*` 原封不動轉給後端（`frontend/next.config.ts` 的 `rewrites`），所以瀏覽器覺得自己只在跟 `localhost:3100` 說話，沒有 CORS 問題
- **Spring Boot** 是這份教程的主角
- **MongoDB** 存所有資料（帳號、錢包、注單、期數）
- **Redis** 只存一件事：每個帳號「目前有效的登入」是哪一個（第 7 章）

## 3. 資料夾地圖

```
backend/
├── pom.xml                         ← 相當於 package.json：依賴、版本、建置設定
├── mvnw、mvnw.cmd、.mvn/           ← Maven Wrapper：不用自己裝 Maven（≈ 鎖定版本的 npx）
├── Dockerfile                      ← 上線到 Render 時用
└── src/
    ├── main/
    │   ├── java/com/thirtylab/     ← 程式碼
    │   │   ├── ThirtyLabBackendApplication.java   ← 進入點（≈ main.ts）
    │   │   ├── common/             ← 大家共用：統一回應格式、錯誤碼、錯誤處理
    │   │   ├── config/             ← 設定類別：安全、WebSocket、排程、各種 Properties
    │   │   ├── account/            ← 帳戶模組：註冊、登入、JWT、session
    │   │   ├── wallet/             ← 錢包模組：餘額、積分流水、每日簽到
    │   │   ├── draw/               ← 開獎模組：期數、開獎排程、冷熱號碼
    │   │   ├── betting/            ← 投注模組：下注、我的注單
    │   │   ├── settlement/         ← 結算模組：判獎、彩池、派彩
    │   │   ├── rules/              ← 遊戲規則：獎級、中獎組合數
    │   │   └── stats/              ← 統計：排行榜、每期中獎名單
    │   └── resources/
    │       ├── application.properties         ← 設定檔（≈ .env + config）
    │       └── application-cloud.properties   ← 只有上線時才生效的設定
    └── test/
        ├── java/com/thirtylab/     ← 測試，資料夾結構跟 main 一模一樣
        └── resources/application-test.properties  ← 只有跑測試時才生效的設定
```

### 每個模組裡面再分 5 種資料夾

以 `wallet/` 為例：

| 資料夾 | 放什麼 | 例子 | NestJS 對照 |
|---|---|---|---|
| `controller/` | 接 HTTP 請求，決定網址 | `WalletController` | `@Controller` |
| `service/` | 業務規則 | `WalletService`、`DailyBonusService` | `@Injectable` service |
| `repository/` | 讀寫資料庫 | `WalletRepository` | TypeORM Repository |
| `model/` | 資料庫裡的資料形狀 | `Wallet`、`WalletTransaction` | Entity |
| `dto/` | API 進出的資料形狀 | `WalletResponse` | DTO class |

> **為什麼 model 和 dto 要分開？** `Wallet`（model）有 `id`、`userId`、`createdAt`，但 API 只想回傳 `{ balance }`。分開之後，資料庫多了欄位也不會不小心送到前端（例如 `User` 裡的 `passwordHash` 絕對不能回傳）。

## 4. `pom.xml`：專案的 package.json

打開 `backend/pom.xml`，重要的部分：

```xml
<parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>4.1.1</version>          <!-- Spring Boot 版本：所有 spring 套件的版本都由它決定 -->
</parent>

<groupId>com.thirtylab</groupId>      <!-- 組織名稱，慣例是反過來的網域 -->
<artifactId>30-lab-backend</artifactId>  <!-- 專案名稱，打包出來是 30-lab-backend-0.0.1-SNAPSHOT.jar -->

<dependencies>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-webmvc</artifactId>   <!-- 沒寫版本：用 parent 決定的版本 -->
    </dependency>
    ...
</dependencies>
```

| 依賴（starter） | 做什麼 | npm 對照 |
|---|---|---|
| `spring-boot-starter-webmvc` | HTTP 伺服器（內建 Tomcat）、Controller、JSON | `express` + `@nestjs/core` |
| `spring-boot-starter-validation` | `@NotNull`、`@Size` 這些驗證 | `class-validator` |
| `spring-boot-starter-data-mongodb` | 連 MongoDB、Repository | `mongoose` / `@nestjs/mongoose` |
| `spring-boot-starter-data-redis` | 連 Redis | `ioredis` |
| `spring-boot-starter-security` | 登入、權限 | `passport` + guards |
| `spring-boot-starter-websocket` | WebSocket | `socket.io` |
| `spring-boot-starter-actuator` | `/actuator/health` 健康檢查 | `@nestjs/terminus` |
| `springdoc-openapi-starter-webmvc-ui` | Swagger | `@nestjs/swagger` |
| `jjwt-*` | 產生、驗證 JWT | `jsonwebtoken` |
| `lombok` | 自動產生 getter、建構子（第 2 章） | — |
| `spring-boot-devtools` | 改了程式自動重啟 | `nest start --watch` |
| `*-test` | 測試工具 | `jest` |

**starter** 是「一整包常一起用的套件」。加一個 starter，相關的套件和自動設定就全部進來了，不用自己一個個挑版本。

### 常用指令（在 `backend/` 裡）

| Maven | npm 對照 | 做什麼 |
|---|---|---|
| `.\mvnw.cmd spring-boot:run` | `npm run start:dev` | 啟動 |
| `.\mvnw.cmd test` | `npm test` | 跑全部測試 |
| `.\mvnw.cmd clean compile` | `rm -rf dist && tsc` | 清掉舊的編譯結果重新編譯 |
| `.\mvnw.cmd package` | `npm run build` | 打包成一個 `.jar` 檔（上線用） |

編譯結果放在 `backend/target/`（≈ `dist/`），不用進 Git。

## 5. 按下「執行」之後發生了什麼

進入點只有這幾行：

```java
package com.thirtylab;

@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
@ConfigurationPropertiesScan
public class ThirtyLabBackendApplication {

	public static void main(String[] args) {
		SpringApplication.run(ThirtyLabBackendApplication.class, args);
	}
}
```

- `public static void main(String[] args)`：Java 程式的固定進入點，JVM 會找這個方法來執行（≈ Node 執行 `main.ts` 的第一行）
- `SpringApplication.run(...)`：把控制權交給 Spring（≈ `NestFactory.create(AppModule)` + `app.listen()`）
- `@SpringBootApplication`：一次開啟三件事：
  1. **自動掃描**：從 `com.thirtylab` 這個 package 開始，往下找所有加了 `@Component`、`@Service`、`@RestController`、`@Configuration` 的 class
  2. **自動設定**：看 `pom.xml` 有哪些 starter，自動幫你設定好（有 mongodb starter → 自動建立 MongoDB 連線）
  3. 這個 class 本身也是一個設定類別
- `exclude = UserDetailsServiceAutoConfiguration.class`：Spring Security 預設會建立一個「user / 隨機密碼」的帳號，我們用自己的 JWT 登入，所以把它關掉
- `@ConfigurationPropertiesScan`：自動找出所有 `@ConfigurationProperties` 的設定類別（第 4 章）

### 啟動的每一步

在 IntelliJ 執行後端，對照 console 的日誌看：

| 順序 | 發生什麼 | 日誌裡看得到 |
|---|---|---|
| 1 | 讀 `application.properties`（有 profile 的話再讀 `application-xxx.properties` 覆蓋） | `No active profile set, falling back to 1 default profile: "default"` |
| 2 | 掃描 `com.thirtylab` 底下所有 class，找出要建立的 Bean | `Bootstrapping Spring Data MongoDB repositories ... Found 5 MongoDB repository interfaces` |
| 3 | **依照依賴關係**建立所有 Bean：先建沒有依賴的，再建依賴它們的（第 3 章） | — |
| 4 | 連 MongoDB；因為 `spring.data.mongodb.auto-index-creation=true`，**檢查並建立索引** | `Monitor thread successfully connected to server` |
| 5 | 建立 Security 規則、WebSocket 端點 | — |
| 6 | 啟動內建的 Tomcat，開始聽 8088 | `Tomcat started on port 8088 (http)` |
| 7 | 執行所有 `ApplicationRunner`（`PrizeSummaryBackfill`：補算舊期數的統計） | 有補算時會印 `補算獎級統計：N 期` |
| 8 | 排程開始：`DrawTicker`、`SettlementTicker` 每秒執行一次 | `Started ThirtyLabBackendApplication in 3.2 seconds` 之後開始看到 `OPENED 20261023-0042` |

**跟 Node 最大的不同**：Node 的 `import` 是你自己寫的，執行到哪載入到哪；Spring 是**啟動時一次把所有東西建好、接好**，所以啟動比 Node 慢幾秒，但之後每個請求都不用再建立物件。也因為這樣，**很多錯誤會在啟動時就爆出來**（例如找不到某個依賴、設定值不合法），而不是等到有人打 API 才發現。

## 6. 一個請求的旅程（預告）

```
GET /api/wallet
  → Tomcat 收到請求
  → Security filter：看 cookie，知道你是誰（第 7 章）
  → DispatcherServlet：找到對應的 Controller 方法（第 5 章）
  → WalletController.balance(userId)
  → WalletService.balance(userId)
  → WalletRepository.findByUserId(userId) → MongoDB
  ← Wallet 物件
  ← WalletResponse(balance)
  ← Result.ok(...) → Jackson 轉成 JSON：{ "code": 0, "msg": "ok", "data": { "balance": 10000 } }
```

第 5 章會把這條路上的每一個 class 打開來看。

---

## 小練習

1. 執行後端，在 console 找到 `Tomcat started on port` 那一行，看看啟動花了幾秒。
2. 打開 http://localhost:8088/actuator/health，看到 `"status":"UP"`。再看裡面的 `mongo`、`redis` 兩項：這是 actuator 自動幫你檢查的。
3. 把 Docker 的 Redis 停掉（`docker stop tl-redis`），再看一次 health，會變成什麼？看完記得 `docker start tl-redis`。
4. 在 `pom.xml` 找到 `jjwt-api`，它的版本寫的是 `${jjwt.version}`，這個變數在哪裡定義？（提示：`<properties>`）

下一章：[02 Java 語法](02-java-for-ts.md)
