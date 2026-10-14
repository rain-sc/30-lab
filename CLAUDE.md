# Mark Six Lab

六合彩模擬遊戲：用**虛擬積分**遊玩的 6/49 選號網頁遊戲。個人學習與面試作品，不涉及真錢。
前端 Next.js（`frontend/`）+ 後端 Java + Spring Boot（`backend/`），單一 Git 倉庫（monorepo）。

> 這份文件是前端、後端兩個對話的**共同約定**。在 `backend/` 或 `frontend/` 啟動 Claude Code 時，會同時讀到這份和子目錄的 `CLAUDE.md`。

## 對話規則（必須遵守）

- **一律用繁體中文回覆**，包括長篇說明、表格、程式碼審查。只有程式碼、指令、專有名詞保留英文。
- 這是**全新的個人專案**：不要讀取、搜尋或參考其他專案（例如 `D:\lottery-game-client`，那是公司代碼）。
- 用戶是**前端工程師，正在學 Java / Spring Boot / MongoDB**。後端部分以導師方式一步步教：用前端概念類比、留小練習、review 時實際跑測試驗證。前端部分用戶熟悉，可以直接討論方案。
- 用戶說「先別做」時只討論不動手；動手前確認範圍。

## 已確定的決策

| 項目 | 決定 |
|---|---|
| 玩法 | 先做**單式**（1~49 選 6 個）；複式、膽拖在階段 4 |
| 下注 | 虛擬積分，每注 10 積分，不能儲值或兌換 |
| 開獎 | 系統定時自動開獎，**每 5 分鐘一期** |
| 截止下注 | **開獎前 15 秒** |
| 開獎號碼 | 6 個正碼 + 1 個特別號碼，`SecureRandom` |
| 形式 | 響應式網頁（手機優先） |
| 後端 | Java 21 + Spring Boot 4.1 + **MongoDB**（副本集）+ Redis |
| 前端 | Next.js 16（App Router）+ React 19 + TypeScript + Tailwind 4 |
| 架構 | 後端是**模組化單體**（按業務模組分包），不拆微服務 |

詳細規則見 [docs/game-rules.md](docs/game-rules.md)，規劃文件：https://claude.ai/code/artifact/8b6f7bc0-a7c1-4a3d-aa33-69ebb7988e50

## 前後端協作約定

### API 規範
- 所有接口路徑以 `/api` 開頭；統一回傳 `{ code, msg, data }`，`code = 0` 表示成功。
- 失敗時 `code` 是 **5 位數業務錯誤碼**：前 3 碼 = HTTP 狀態碼，後 2 碼 = 流水號（`00` 是該狀態的通用錯誤），例如 `40901` 帳號已被使用。總表在後端 `common/ErrorCode.java`。
- **錯誤訊息的 i18n 由前端負責**：前端依 `code` 翻譯（zh-TW / en），`msg` 只是給開發看的中文說明和備用文字。
- 欄位驗證失敗是 `40001`，`data` 為 `[{ field, rule }]`（`rule` 是驗證規則名稱，如 `pattern`、`size`、`notBlank`）。
- 時間一律是 UTC ISO 字串（`2026-10-14T03:00:00.000Z`），由前端轉成本地時區顯示。
- 積分一律是**整數**。
- 分頁回傳 `{ list, total, page, size }`，`page` 從 1 開始。

### 契約與同步流程
1. **後端**新增或修改 API 時：
   - 更新 Swagger 註解（`@Operation`、`@Schema`）
   - 匯出契約：`curl http://localhost:8088/v3/api-docs -o docs/api/openapi.json`
   - 在 [docs/api-changelog.md](docs/api-changelog.md) **最上面**加一筆：日期、接口、改了什麼、前端要做什麼
2. **前端**開始工作時：
   - 先看 `docs/api-changelog.md` 有沒有新的變更
   - 從 `docs/api/openapi.json` 重新生成類型（`npm run gen:api`，用 openapi-typescript，階段 1 加入）
   - 型別對不上 = 契約變了，以後端為準
3. 需要對方配合的事項，也寫進 `docs/api-changelog.md`（標註「待後端」/「待前端」）。

### 即時推送
- WebSocket（STOMP）**直連後端** `ws://localhost:8088/ws`，不經過 Next.js 轉發；後端用 `app.cors.allowed-origins` 允許前端來源。

## 本機環境

| 服務 | 位址 | 備註 |
|---|---|---|
| 前端 | http://localhost:3100 | `/api/*` 由 next.config.ts 轉發到後端 |
| 後端 | http://localhost:8088 | 避開 8080（用戶的練習項目）和 8090（本機其他程式） |
| Swagger | http://localhost:8088/swagger-ui.html | |
| 健康檢查 | http://localhost:8088/actuator/health | |
| MongoDB | localhost:27018 | Docker，單節點副本集 `rs0`；避開本機已安裝的 27017 |
| Redis | localhost:6380 | Docker；避開本機已安裝的 6379 |

```powershell
docker compose up -d                                  # 啟動 MongoDB + Redis（需要先開 Docker Desktop）
cd backend;  .\mvnw.cmd spring-boot:run               # 啟動後端（或在 IntelliJ 執行 main）
cd frontend; npm run dev                              # 啟動前端
```

開發工具：後端用 **IntelliJ IDEA**，前端用 **VS Code**。

## 文件索引

| 文件 | 內容 |
|---|---|
| [docs/game-rules.md](docs/game-rules.md) | 遊戲規則、獎級、彩池、時間軸 |
| [docs/data-model.md](docs/data-model.md) | MongoDB 集合、字段、索引（草稿） |
| [docs/state-machines.md](docs/state-machines.md) | 期數、注單的狀態流轉 |
| [docs/draw-animation.md](docs/draw-animation.md) | 開獎動畫方案、後端需要配合的事項；原型在 `docs/prototypes/` |
| [docs/api-changelog.md](docs/api-changelog.md) | 前後端交接記錄 |
| [docs/api/](docs/api/) | OpenAPI 契約 |
| [backend/CLAUDE.md](backend/CLAUDE.md) | 後端約定 |
| [frontend/CLAUDE.md](frontend/CLAUDE.md) | 前端約定 |

## 目前進度

**階段 0：規劃**。專案骨架已建立；下一步是確定資料模型、狀態機、階段 1 的 API 設計。
開獎攪珠動畫方案已確定，見 [docs/draw-animation.md](docs/draw-animation.md)（含後端需要配合的事項）。
前端按 [frontend/CLAUDE.md](frontend/CLAUDE.md) 的「遊戲端開發順序」進行，下一步：i18n 骨架。
