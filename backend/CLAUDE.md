# 後端（Spring Boot）

共同約定見根目錄 [../CLAUDE.md](../CLAUDE.md)（語言、決策、前後端協作流程）。這裡只放後端自己的約定。

用戶正在學 Java / Spring Boot / MongoDB：**以導師方式一步步教**，用前端概念類比，關鍵處留給用戶自己寫，review 時實際編譯、跑請求驗證。

## 技術棧

| 類別 | 目前 | 之後加入（用到時再加，不提前堆依賴） |
|---|---|---|
| 框架 | Spring Boot 4.1.1、Java 21、Maven | |
| Web | spring-boot-starter-webmvc、validation、websocket | |
| 資料 | spring-boot-starter-data-mongodb、data-redis | Mongock（索引與初始化數據的版本管理） |
| 文件 / 監控 | springdoc 3.1.1、actuator | |
| 工具 | Lombok、DevTools | MapStruct（DTO 轉換） |
| 安全 | Spring Security、jjwt 0.13（JWT 放 HttpOnly cookie） | |
| 定時任務 | Spring `@Scheduled`（每秒對帳：開獎、結算） | 不用 ShedLock：開獎、結算的每一步都是條件更新 + 唯一索引，多台同時跑也不會重複。多台部署真正的阻礙是 WebSocket 用記憶體內 broker，要換成外部 broker（RabbitMQ 等）時再處理 |
| 測試 | spring-boot-starter-*-test | Testcontainers（MongoDB、Redis） |

## 包結構（按業務模組分包）

```
com.marksixlab
├── common/        Result、ErrorCode、BusinessException、全局異常處理、PageResult
├── config/        Mongo、Redis、WebSocket、Security、Swagger 等配置
├── account/       帳戶：註冊、登入、JWT
├── wallet/        錢包：餘額、積分流水
├── betting/       投注：選號、下注、注單
├── draw/          開獎：期數、定時任務、號碼生成、開獎紀錄、冷熱號碼
├── settlement/    結算：判獎、彩池、派彩
├── rules/         遊戲規則：對外公開的設定、獎級、中獎組合數
└── stats/         統計：跨模組的統計（排行榜：組合 wallet 的名次〔派彩總額 / 餘額〕+ account 的暱稱；只讀開獎資料的放在 draw）
```

每個模組內部再分 `controller/`、`service/`、`repository/`、`model/`、`dto/`。
模組之間**透過 Service 調用**，不直接用別的模組的 Repository。

## 編碼約定

- Controller 只處理 HTTP；業務規則在 Service；Repository 只管讀寫。
- 每個 `@RequestBody` 前面都要有 `@Valid`。
- 回傳 `Result<T>`；錯誤一律 `throw new BusinessException(ErrorCode.XXX)`，由全局處理器轉成統一格式。新的錯誤加進 `common/ErrorCode`，並在 `api-changelog.md` 通知前端加翻譯。
- 時間用 `Instant`，截斷到毫秒；積分用 `long`。
- 比較物件用 `equals`，不用 `==`。
- 敏感資料（密碼雜湊、token）不回傳、不打日誌。
- 新增或修改 API 後：更新 Swagger 註解 → 匯出 `docs/api/openapi.json` → 記錄 `docs/api-changelog.md`。

## 常用命令

```powershell
.\mvnw.cmd spring-boot:run              # 啟動（或 IntelliJ 執行 MarkSixLabBackendApplication）
.\mvnw.cmd clean compile                # 完整編譯（懷疑 IDE 報錯不準時用）
.\mvnw.cmd test                         # 跑測試
```

需要先 `docker compose up -d`（在根目錄）啟動 MongoDB 和 Redis。
