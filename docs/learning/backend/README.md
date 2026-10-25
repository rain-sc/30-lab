# 後端新手教程：用 30 Lab 學 Spring Boot + MongoDB

寫給「會前端、寫過一點 NestJS + PostgreSQL，但 Java / Spring 還是新手」的自己。

每一章的寫法都一樣：

1. **先講要解決什麼問題**：沒有它會怎樣
2. **用你熟悉的東西類比**：React / TypeScript / NestJS / SQL
3. **打開專案裡真的程式碼，一行一行講**：所有程式碼都是從 `backend/src/main/java/com/thirtylab/` 複製出來的，不是示意
4. **常見錯誤**：這個專案真的踩過的坑
5. **小練習**：讀完自己動手確認看懂了，不用寫新功能

> **Java / Spring 的一般基礎**（這個專案沒用到、但新手一定要懂、面試常問的）在 [新手基礎篇](../basics/README.md)：Java 篇 9 章 + Spring 篇 6 章 + 面試問答。建議先讀這裡的 01~05 章，再去補基礎篇。
>
> 原本那份 [backend-study-notes.md](../backend-study-notes.md) 改成**速查表**：學完回來查用，內容很濃縮，第一次學不要從那份開始。
> 整個系統的架構圖、流程圖、API 總表在 [project-workflow.md](../project-workflow.md)。

---

## 閱讀順序

前 5 章是基礎，**一定要照順序讀**；第 6 章之後每章對應一個功能，可以挑有興趣的先看。

| 章 | 主題 | 讀完你會懂 | 對應的前端 / NestJS 概念 |
|---|---|---|---|
| [01](01-big-picture.md) | 全貌：後端在做什麼、啟動時發生什麼 | 資料夾地圖、`pom.xml`、按下執行之後的每一步 | `package.json`、`main.ts` |
| [02](02-java-for-ts.md) | Java 語法（給 TypeScript 工程師） | 看得懂專案裡每一行 Java | TS 型別、class、陣列方法 |
| [03](03-spring-bean-di.md) | Spring 核心：Bean 與依賴注入 | 為什麼 class 不用 `new`、`@Service` 做了什麼 | NestJS 的 `@Injectable`、`@Module` |
| [04](04-configuration.md) | 設定檔與環境 | `application.properties`、環境變數、profile | `.env`、`ConfigModule` |
| [05](05-first-api.md) | 第一支 API：從網址到資料庫再回來 | 一個請求經過哪些 class、JSON 怎麼來的 | Controller / Service / Repository |
| [06](06-validation-errors.md) | 驗證與錯誤處理 | `@Valid`、錯誤碼、`GlobalExceptionHandler` | `ValidationPipe`、Exception Filter |
| [07](07-security-login.md) | 登入：Security、JWT、Redis session | 一個請求怎麼知道「你是誰」、怎麼踢掉舊登入 | Guard、Passport、middleware |
| [08](08-mongodb.md) | MongoDB 與 Spring Data | 文件、集合、索引、Repository、MongoTemplate | TypeORM / Prisma、SQL |
| [09](09-betting-transactions.md) | 下注：交易、並發、冪等 | 怎麼保證不重複扣款、不扣成負數 | DB transaction、重送請求 |
| [10](10-scheduling-draws.md) | 開獎：排程與狀態機 | 每 5 分鐘一期是怎麼跑起來的 | `setInterval`、狀態機 |
| [11](11-settlement.md) | 結算派彩：可以重跑的流程 | 當機重啟也不會重複派彩 | 冪等的背景工作 |
| [12](12-aggregation.md) | 聚合管線：排行榜 | `$group`、`$rank`、`$lookup`、`$topN` | SQL `GROUP BY`、window function |
| [13](13-websocket.md) | WebSocket 推播 | 開獎通知怎麼送到每個瀏覽器 | socket.io、`@WebSocketGateway` |
| [14](14-testing.md) | 測試 | 單元測試、整合測試、怎麼在 IntelliJ 跑一個測試 | Jest |
| [15](15-pitfalls-interview.md) | 踩過的坑與面試重點 | 遇到錯誤怎麼查、面試怎麼講這個專案 | — |

---

## 怎麼讀最有效

**一邊讀一邊打開 IntelliJ**，不要只看文件：

| 想做的事 | IntelliJ 操作 |
|---|---|
| 跳到某個 class 或方法的定義 | 按住 `Ctrl` 點名字（或 `Ctrl + B`） |
| 找誰呼叫了這個方法 | 游標放在方法名稱上，`Alt + F7`（Find Usages） |
| 用名字找 class | 連按兩下 `Shift`，輸入 `WalletService` |
| 看 Lombok 幫你產生了什麼 | 在 Project 視窗打開 class，左下角 Structure（`Alt + 7`） |
| 讓程式停在某一行，看變數的值 | 在行號旁點一下設中斷點，用 **Debug**（小蟲圖示）啟動後端，再用瀏覽器或 Swagger 打 API |

**中斷點是最好的老師**。讀第 5 章時，在 `WalletController.balance` 設中斷點、從 Swagger 打 `GET /api/wallet`，一步一步按 `F8`（下一行）、`F7`（進入方法），就能親眼看到請求怎麼走。

## 先準備好的環境

```powershell
docker compose up -d                       # 在根目錄：啟動 MongoDB（tl-mongodb）和 Redis（tl-redis）
cd backend; .\mvnw.cmd spring-boot:run     # 或在 IntelliJ 執行 ThirtyLabBackendApplication
```

- Swagger（可以直接在網頁上打 API）：http://localhost:8088/swagger-ui.html
- 看資料庫：MongoDB Compass 或 IntelliJ 的 Database 視窗，連 `mongodb://localhost:27018/?directConnection=true`，資料庫 `thirtylab`

## 名詞小抄

第一次看到不懂的詞，先查這裡，各章會再詳細講。

| 名詞 | 一句話解釋 | 類比 |
|---|---|---|
| Bean | Spring 幫你建立、保管的物件 | NestJS 的 provider 實例 |
| 依賴注入（DI） | 需要什麼就在建構子宣告，Spring 自動塞進來 | NestJS constructor 注入 |
| Annotation（註解） | `@` 開頭的標記，讓框架知道這個 class / 欄位要怎麼處理 | TS decorator |
| DTO | 進出 API 的資料形狀 | TS 的 `type` / `interface` |
| Entity / Model | 存進資料庫的資料形狀 | TypeORM Entity |
| Repository | 讀寫某個集合的物件 | TypeORM Repository |
| 集合（collection） | MongoDB 的「表」 | SQL table |
| 文件（document） | MongoDB 的「一筆資料」，長得像 JSON | SQL row |
| 交易（transaction） | 幾個寫入要嘛全部成功、要嘛全部取消 | SQL `BEGIN ... COMMIT` |
| 冪等（idempotent） | 同一件事做兩次，結果跟做一次一樣 | 重複按「送出」不會下兩次單 |
| Profile | 一組只在特定環境生效的設定 | `.env.test`、`.env.production` |
