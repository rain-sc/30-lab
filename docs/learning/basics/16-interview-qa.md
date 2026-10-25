# 面試問答

常見的 Java / Spring 後端面試題，每題附上**回答方向**和**詳細內容在哪一章**。準備方式：先自己用嘴巴回答一次，再看答案；答不出來的回到那一章重讀。

> 面試官最喜歡的是「**用你自己的專案舉例**」。每一題能扯到 30 Lab 的，都標了 🎯。

---

## Java 基礎

**1. JDK、JRE、JVM 的差別？** → [J1](01-jvm-and-runtime.md)
JVM 執行 bytecode；JRE = JVM + 標準函式庫；JDK = JRE + 編譯器等開發工具。

**2. `==` 和 `equals()` 的差別？** → [J2](02-language-basics.md)
`==` 對物件比較是不是同一個物件；`equals` 比較內容。包裝型別用 `==` 有快取陷阱（-128~127）。

**3. 為什麼覆寫 `equals` 一定要覆寫 `hashCode`？** → [J3](03-oop.md)
HashMap / HashSet 先用 hashCode 找桶子，再用 equals 比較；equals 相等但 hashCode 不同，會找不到。用 record 自動產生最安全。

**4. String 為什麼不可變？`StringBuilder` 和 `StringBuffer`？** → [J2](02-language-basics.md)
安全、可共用、執行緒安全、適合當 key。StringBuilder 可變不同步；StringBuffer 同步（較慢）。

**5. `final`、`finally`、`finalize` 的差別？**
`final` 修飾變數 / 方法 / class（不可改 / 不可覆寫 / 不可繼承）；`finally` 是 try 之後一定執行的區塊；`finalize` 是已淘汰的 GC 回呼，不要用。

**6. interface 和 abstract class 的差別？** → [J3](03-oop.md)
interface 定義能力、可實作多個、沒有狀態；abstract class 可以有狀態和建構子、只能繼承一個。

**7. overload 和 override？** → [J3](03-oop.md)
同名不同參數（編譯時）vs 子類別重新實作（執行時、多型）。

**8. checked 和 unchecked 例外？** → [J5](05-exceptions.md)
checked 要宣告或處理，代表可預期的外部問題；unchecked 是 RuntimeException，代表 bug 或違反規則。🎯 30 Lab 的 `BusinessException` 是 unchecked，配合 `@Transactional` 預設只回滾 unchecked。

**9. Java 是傳值還是傳參考？** → [J2](02-language-basics.md)
永遠傳值；物件傳的是參考的副本。

**10. 什麼是不可變物件？怎麼做？**
建立後狀態不會變：欄位 `private final`、不提供 setter、可變的欄位（List）做防禦性複製。record 是最簡單的方式。好處：執行緒安全、可以當 key、好推理。

## 集合

**11. `ArrayList` vs `LinkedList`？** → [J4](04-generics-collections.md)
陣列 vs 鏈結；隨機存取 O(1) vs O(n)；實務上幾乎都用 ArrayList。

**12. `HashMap` 的原理？** → [J4](04-generics-collections.md)
陣列 + 鏈結串列 / 紅黑樹；hashCode 決定桶子，equals 比較；負載因子 0.75 時擴容兩倍。

**13. `HashMap` 是執行緒安全的嗎？要用什麼？** → [J7](07-concurrency.md)
不是。用 `ConcurrentHashMap`，而且要用它的原子方法（`merge`、`computeIfAbsent`）。

**14. `List.of` 和 `Arrays.asList` 的差別？** → [J4](04-generics-collections.md)
List.of 完全不可變、不接受 null；Arrays.asList 固定長度但可以 set、背後是原本的陣列。

## Lambda 與 Stream

**15. 什麼是函式介面？** → [J6](06-functional-streams.md)
只有一個抽象方法的介面，可以用 lambda 實作。

**16. Stream 的中間操作和終端操作？** → [J6](06-functional-streams.md)
中間操作回傳 Stream、懶惰；終端操作觸發執行。一個 Stream 只能用一次。

**17. `Optional` 的正確用法？** → [J6](06-functional-streams.md)
只當回傳值；用 `map` / `orElse` / `orElseThrow`，不要 `isPresent() + get()`；`orElseGet` 延遲計算。

## 並發

**18. 執行緒安全是什麼？怎麼做到？** → [J7](07-concurrency.md)
多條執行緒同時用時結果還是正確。最好的方法是不共享可變狀態；其次是原子類別、並發集合、`synchronized`。

**19. Spring 的單例 Bean 執行緒安全嗎？** → [J7](07-concurrency.md)
不保證。無狀態的 Service（欄位只放依賴）就安全。🎯 30 Lab 的 Service 全部無狀態，請求的資料都用方法參數傳。

**20. `synchronized` vs `volatile`？** → [J7](07-concurrency.md)
互斥 + 可見性 vs 只有可見性。

**21. 為什麼用執行緒池？** → [J7](07-concurrency.md)
重用執行緒、限制數量、避免耗盡資源。🎯 30 Lab 的排程用 2 條執行緒的池，開獎和結算互不阻塞。

**22. 什麼是虛擬執行緒？** → [J7](07-concurrency.md)
Java 21 的輕量執行緒，等 I/O 時不佔用作業系統執行緒；用同步的寫法得到非同步的擴展性。

**23. 單機的鎖在多台伺服器有用嗎？** → [J7](07-concurrency.md)
沒用。要用資料庫的條件更新 / 唯一索引 / 樂觀鎖，或分散式鎖。🎯 30 Lab 全部用資料庫的條件更新和唯一索引，所以多台同時跑排程也不會重複開獎、重複派彩，不需要 ShedLock。

## Spring 核心

**24. IoC 和 DI？** → [S2](11-ioc-aop.md)
物件的建立和組裝交給容器；依賴從外部注入。

**25. Bean 的作用域和生命週期？** → [S2](11-ioc-aop.md)
singleton（預設）、prototype、request、session；建立 → 注入 → `@PostConstruct` → 使用 → `@PreDestroy`。

**26. 建構子注入的好處？** → [S2](11-ioc-aop.md)
final、依賴明確、好測試、啟動時就發現循環依賴。

**27. 什麼是 AOP？Spring 怎麼實作？** → [S2](11-ioc-aop.md)
把橫切關注點（交易、日誌、權限）抽出來；用代理（CGLIB / JDK 動態代理）。

**28. `@Transactional` 什麼時候失效？** → [S4](13-data-jpa-transactions.md)
自我呼叫、private 方法、checked 例外、例外被吞掉、不是 Spring Bean。🎯 30 Lab 實際踩過自我呼叫：每日簽到寫在 `WalletService` 裡自己呼叫 `credit`，第二次簽到時流水撞索引，但錢已經加上去了。搬到獨立的 `DailyBonusService` 解決。

**29. `@Transactional` 的傳播行為？** → [S4](13-data-jpa-transactions.md)
REQUIRED（加入或新開）、REQUIRES_NEW（暫停外面的開新的）等。🎯 30 Lab 下注時外層 `TransactionTemplate`，內層 `debit` 是 REQUIRED，所以三個寫入在同一個交易。

**30. Spring Boot 自動設定的原理？** → [S1](10-spring-boot-overview.md)
一堆 `@AutoConfiguration` 類別 + `@Conditional`；使用者的 Bean 優先（`@ConditionalOnMissingBean`）。

**31. 設定的優先順序？** → [S1](10-spring-boot-overview.md)
命令列 > 環境變數 > 外部設定檔 > jar 內的設定檔；profile 專屬的蓋掉一般的。

**32. Spring 和 Spring Boot 的差別？** → [S1](10-spring-boot-overview.md)

## Web

**33. Spring MVC 處理請求的流程？** → [S3](12-web-mvc.md)
Filter → DispatcherServlet → HandlerMapping → Interceptor → 參數解析 / 驗證 → Controller → 訊息轉換 → 例外處理。

**34. Filter vs Interceptor？** → [S3](12-web-mvc.md)

**35. 怎麼做全域錯誤處理？** → [S3](12-web-mvc.md)
`@RestControllerAdvice` + `@ExceptionHandler`。🎯 30 Lab 統一回 `{ code, msg, data }`，code 是 5 位數（前 3 碼 = HTTP 狀態），前端依 code 做 i18n；Security 的 401 也透過 `HandlerExceptionResolver` 轉進同一個處理器。

**36. 怎麼設計 RESTful API？**
資源用名詞複數、HTTP 方法表達動作、正確的狀態碼、分頁、版本、一致的錯誤格式、冪等（PUT / DELETE；POST 用冪等鍵）。🎯 30 Lab 的下注用 `idempotencyKey` 讓 POST 也能安全重送。

## 資料庫

**37. JPA / Hibernate / Spring Data JPA？** → [S4](13-data-jpa-transactions.md)

**38. N+1 問題？** → [S4](13-data-jpa-transactions.md)
🎯 30 Lab 排行榜要 20 個人的暱稱，先收集 id 再一次 `findAllById`，避免 N+1。

**39. 樂觀鎖和悲觀鎖？** → [S4](13-data-jpa-transactions.md)
🎯 30 Lab 用第三種：條件更新（`balance >= cost` 才扣），檢查和修改是一個原子操作。

**40. 交易的 ACID 和隔離等級？** → [S4](13-data-jpa-transactions.md)

**41. 索引怎麼設計？** → [專案教程第 8 章](../backend/08-mongodb.md)
依查詢設計；複合索引依 ESR（等於 → 排序 → 範圍）；用 explain 確認。

**42. SQL 和 NoSQL 怎麼選？**
關係複雜、需要 JOIN 和強一致性 → SQL；資料結構會變、需要嵌入、水平擴展 → 文件資料庫。🎯 30 Lab 選 MongoDB：注單的多注和結果適合嵌入文件；但要記得交易需要副本集、跨集合的關聯要在程式裡組合。

## 測試

**43. 單元測試和整合測試？** → [S5](14-testing.md)

**44. 怎麼測 Controller？** → [S5](14-testing.md)
MockMvc。

**45. 什麼時候用 mock？** → [S5](14-testing.md)
外部服務、想模擬失敗；資料庫的邏輯用真的資料庫測（Testcontainers）。🎯 30 Lab 的核心邏輯在條件更新和唯一索引，所以直接連真的 MongoDB 測，包括並發和「當機後重跑」。

## 系統設計（用 30 Lab 回答）

**46. 怎麼保證不重複扣款？**
冪等鍵（前端產生 UUID、重送沿用）+ 唯一索引 + 條件扣款 + 交易衝突時重試（重試前先查）。→ [專案教程第 9 章](../backend/09-betting-transactions.md)

**47. 批次處理（結算）中途當機怎麼辦？**
不包大交易，每一步可重跑：條件更新 + 唯一索引 + 最後才標記完成。→ [專案教程第 11 章](../backend/11-settlement.md)

**48. 定時任務在多台伺服器怎麼避免重複執行？**
狀態轉換都是條件更新（每秒對帳），重複執行也安全；或用 ShedLock 這種分散式鎖。→ [專案教程第 10 章](../backend/10-scheduling-draws.md)

**49. 怎麼做「同一個帳號只能一個登入」？**
JWT + Redis 存目前的 sessionId，原子的 `SET ... GET` 拿到被取代的那個，WebSocket 通知。→ [專案教程第 7 章](../backend/07-security-login.md)

**50. 如果玩家變成 100 倍，哪裡先撐不住？怎麼改？**
結算一次讀整期的注單 → 分批；排行榜每次聚合 → 快取或寫入時累加；WebSocket 記憶體內 broker → 換成 RabbitMQ / Redis Pub/Sub 才能多台；Tomcat 執行緒 → 虛擬執行緒；MongoDB → 讀寫分離、分片。

---

## 自我介紹專案的講法（2 分鐘）

1. **是什麼**：用虛擬積分玩的選號遊戲，每 5 分鐘自動開獎；Next.js + Spring Boot + MongoDB + Redis
2. **我負責 / 學到什麼**：從前端轉後端，用 Spring Boot 做了帳戶、下注、開獎、結算、排行榜，模組化單體
3. **最難的地方**（選一個深入講）：結算的冪等設計 / 並發扣款 / 單一 session 登入
4. **怎麼驗證**：1000+ 個測試，包括並發測試和模擬當機重跑；實際開 1 分鐘一期跑機器人驗證
5. **如果再做一次 / 下一步**：MockMvc 測 HTTP 層、Testcontainers + CI、WebSocket 換外部 broker

上一章：[S6 安全與上線](15-security-and-ops.md)　回到 [目錄](README.md)
