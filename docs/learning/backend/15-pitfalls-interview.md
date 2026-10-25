# 15 踩過的坑與面試重點

## 1. 遇到錯誤時的查法

| 你看到 | 先懷疑 | 怎麼查 |
|---|---|---|
| `cannot find symbol` | 少 import、名字打錯、Lombok 沒產生 | 看是哪個名字找不到；在 IntelliJ 按 `Alt + Enter` 自動 import |
| `APPLICATION FAILED TO START` | 設定錯誤、找不到 Bean、循環依賴 | 往上找 `Description:` 那段，它會說是哪個 class、哪個參數 |
| `Binding to target ... failed` | 設定值不合法（`@Validated` 擋下的） | 看 `Property:` 和 `Reason:` |
| 所有 API 都回 401，header 有 `WWW-Authenticate: Basic` | DevTools 熱重啟時 `SecurityConfig` 沒載入，Spring 用了預設的安全設定 | **完整停止後端再啟動** |
| 不登入打公開 API 回 `40100` | `SecurityConfig` 的 `permitAll` 沒加這個路徑 | 檢查路徑，`/xxx` 和 `/xxx/**` 不一樣 |
| `No static resource api/...`（`40400`） | Controller 方法沒寫、路徑打錯 | 檢查 `@RequestMapping` + `@GetMapping` 組合起來的路徑 |
| `40001` + `rule` | 請求的格式不對 | 看 `field` 是哪個欄位、`rule` 是哪個註解 |
| `50000` | 程式有 bug | **看後端 console**，`未預期的錯誤` 下面有完整的錯誤堆疊 |
| `NullPointerException` | 某個東西是 null | 錯誤堆疊第一行 `at com.thirtylab...` 是你的程式哪一行；常見原因是忘了 `final`（沒被注入）、`Optional` 直接 `.get()` |
| 測試全過但實際打 API 不通 | Service 測試不經過 HTTP、Security | 實際打一次 API |
| IntelliJ 一片紅，但 `mvnw compile` 沒問題 | IntelliJ 的索引不同步 | File → Invalidate Caches，或 Maven 視窗按 Reload |
| `.properties` 裡的中文變 `???` | 檔案編碼 | Settings → File Encodings → Properties Files 設 UTF-8 |

### 讀錯誤堆疊

示意（忘了 `final`，`mongoTemplate` 沒被注入時會看到類似這樣的錯誤）：

```
java.lang.NullPointerException: Cannot invoke "MongoTemplate.findAndModify(...)" because "this.mongoTemplate" is null
    at com.thirtylab.wallet.service.WalletService.debit(WalletService.java:95)          ← 從這裡開始看：你的程式
    at com.thirtylab.betting.service.BettingService.lambda$tryPlace$0(BettingService.java:83)
    at org.springframework.transaction.support.TransactionTemplate.execute(...)        ← 框架的，先跳過
    ...
```

**找第一個 `com.thirtylab` 開頭的那一行**，那是你的程式出問題的地方。Java 的錯誤訊息通常很清楚（`because "this.mongoTemplate" is null`），慢慢讀就看得懂。

## 2. 這個專案真的踩過的坑

| 現象 | 原因 | 解法 | 詳見 |
|---|---|---|---|
| IntelliJ 自動 import 錯 class | `Result`、`Update`、`Id` 都有好幾個同名的 | 看套件名稱，Mongo 的是 `org.springframework.data...` | 第 2 章 |
| 彩池少算 20% | 投注額該用 `Ticket::getCost`，打成了 `Ticket::getPayout`（都是 `long`，編譯器抓不到） | 把數字算死的測試 | 第 14 章 |
| 彩池完全不會增加 | 改獎金時刪掉了 `jackpot-rate-percent`，`long` 拿到預設值 0 | 設定類加 `@Validated` + `@Min(1)`，漏寫就啟動失敗 | 第 4 章 |
| 每日簽到第二次，錢憑空多了 1,000 | 同一個 class 裡自己呼叫 `@Transactional` 方法，繞過代理，交易沒開 | 簽到搬到獨立的 `DailyBonusService` | 第 3 章 |
| 同時簽到 5 次，回 500 | WriteConflict 重試時沒有先查，一直衝突 | 每次重試前先查「今天領過沒」 | 第 9 章 |
| 新的公開 API 不登入回 `40100` | 忘了加 `permitAll`（兩次） | 新增公開 API 要同時改 `SecurityConfig` | 第 7 章 |
| 測試寫進了正式資料庫 | `contextLoads` 測試沒加 `@ActiveProfiles("test")` | 所有 `@SpringBootTest` 都要加 | 第 4 章 |
| 下一個測試類別的唯一索引不見了 | 在 `@AfterAll` 刪掉整個測試資料庫，但 Spring 是跨類別共用的，索引只在啟動時建一次 | 只在 `@BeforeEach` 刪資料，不刪資料庫 | 第 14 章 |
| 匯出的 `openapi.json` 變成 401 的錯誤訊息 | 後端熱重啟後安全設定沒載入，直接覆蓋了檔案 | 先匯出到暫存檔，確認是正常的 JSON 再覆蓋 | — |
| 改了 package 名稱後，IntelliJ 把測試 class 改成奇怪的名字 | 自動推算的名字不一定對 | 改完檢查一次 | — |

## 3. 面試怎麼講這個專案

面試官通常會問：「這個專案最有挑戰的地方是什麼？」下面每一點都可以講 1~2 分鐘，**先講問題，再講你的做法，最後講取捨**。

### ① 冪等的結算流程（最推薦先講）

> **問題**：開獎後要派彩，一期有上百張注單。派到一半當機，重啟後不能重複派、也不能漏派。
>
> **做法**：不用一個大交易包住整個結算（MongoDB 交易有時間和大小限制，也會鎖住大量文件）。改成每一步都可以重跑：判獎用條件更新（只改 PENDING 的）、派彩靠流水的唯一索引（同一張注單的派彩只能寫一次）、期數最後才標記完成。當機後下一秒排程重跑，做過的步驟自動跳過。
>
> **怎麼驗證**：寫了模擬當機的測試，把資料改回「派完彩但還沒標記」的狀態再跑一次，檢查只派了一次。

### ② 每秒對帳的排程

> 不是「時間到觸發一次」，而是每秒檢查「現在應該是什麼狀態」，補做所有該做的事。後端停機 10 分鐘再啟動，會自動補開獎、照時間順序補結算。狀態轉換都是條件更新，所以多台伺服器同時跑也不會重複開獎，不需要分散式鎖。

### ③ 並發安全的扣款

> 扣款用「`balance >= cost` 才扣」的條件 + `$inc`，檢查和扣款是資料庫裡的一個原子操作，兩個請求同時扣也不會扣成負數。下注用冪等鍵（前端每次產生 UUID，重送沿用）+ 唯一索引，重送不會重複扣款。交易衝突時重試，而且重試前先查冪等鍵。有寫並發測試：5 條執行緒同時送同一個下注，只扣一次。

### ④ 單一 session 登入

> JWT 放 HttpOnly cookie（防 XSS），Redis 存每個帳號目前有效的 sessionId。登入時用 Redis 的 `SET ... GET` 原子地寫入新值、拿回舊值，再用 WebSocket 通知被取代的那個 session。舊裝置下次請求時 sessionId 對不上，回 401。

### ⑤ 模組化單體

> 按業務模組分包，模組之間只能透過 Service 呼叫，不能用別人的 Repository，依賴是單向的。需要跨模組資料的功能（排行榜、結算）放在上層模組組合。`$lookup` 只用在同一個模組的集合之間。選單體而不是微服務：規模不需要，單體好部署、好除錯、交易簡單。

### ⑥ 其他可以提的

| 主題 | 一句話 |
|---|---|
| 索引設計 | 依 ESR 規則設計複合索引，用 `explain` 確認用到索引 |
| 寫入時算好 | 每期的獎級統計在結算時存起來，讀的時候不用重算；加了可重複執行的補算 |
| 前後端契約 | OpenAPI 匯出 → 前端產生 TypeScript 型別；統一回應格式、5 位數錯誤碼、i18n 在前端 |
| 設定 fail fast | 設定類加驗證，設定錯了啟動就失敗，不會默默算錯 |
| `@Transactional` 陷阱 | 有實際重現：自己呼叫自己繞過代理，錢憑空增加 |

### 可能被追問的

| 問題 | 回答方向 |
|---|---|
| 為什麼用 MongoDB 不用 PostgreSQL？ | 注單的多注、結果適合嵌入文件，一次讀出；學習目的。也要承認：錢的資料用關聯式資料庫一樣好，MongoDB 的交易需要副本集 |
| 多台伺服器能跑嗎？ | 排程、派彩可以（條件更新 + 唯一索引）。WebSocket 不行：用的是記憶體內的 broker，要換成 RabbitMQ / Redis Pub/Sub |
| 怎麼確定亂數公平？ | `SecureRandom`（密碼學等級）+ 洗牌取前 7 個，等於不放回抽球。測試跑 1000 次檢查範圍和不重複 |
| 如果玩家很多，哪裡會先撐不住？ | 結算時一次讀一期所有注單；排行榜的聚合。可以分批處理、排行榜加快取 |

上一章：[14 測試](14-testing.md)　回到 [目錄](README.md)
