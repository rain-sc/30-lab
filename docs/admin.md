# 後台管理（設計）

階段 3。後端由用戶自己寫（我給規格和提示），前端由前端 session 做 `/admin` 畫面。這份記錄已經決定的設計；API 的細節以 `docs/api/openapi.json` 和 `docs/api-changelog.md` 為準。

## 已決定

| 項目 | 決定 |
|---|---|
| 管理員帳號 | **獨立的 `admins` 集合**，跟玩家完全分開（不在 `users` 加角色） |
| 角色 | 三級：`VIEWER` < `OPERATOR` < `SUPER_ADMIN` |
| 登入 | `/api/admin/auth/*`；cookie `tl_admin_token`（`HttpOnly`、`Path=/api/admin`）；JWT 帶 `type: admin` + `role`，玩家的 token 不能用；Redis `admin-session:{adminId}`，後登入的踢掉前一個、停用時立刻失效 |
| Security | 第二條 `SecurityFilterChain`，只管 `/api/admin/**` |
| 第一個管理員 | 啟動時 `admins` 是空的、且設了 `ADMIN_BOOTSTRAP_USERNAME` / `ADMIN_BOOTSTRAP_PASSWORD`（至少 12 個字元），就建立一個 `SUPER_ADMIN`；已經有管理員就不做 |
| 審計 | `audit_logs` 只新增、不修改不刪除；用自訂註解 + AOP 記錄後台的寫入操作和登入 |
| i18n | 後台畫面做 i18n（前端）；後端只回代碼（錯誤碼、角色、審計動作的 enum），不回給人看的文字 |
| 不做 | 手動指定開獎號碼、直接修改已結算的注單或流水（用補償的 `ADJUSTMENT` 流水 + 審計）、刪除玩家（用停用） |

## 後台前端

**獨立的 Vue 專案**，不放在遊戲端的 Next.js 裡（原本規劃的 `frontend/src/app/admin/` 取消）。

| 項目 | 決定 |
|---|---|
| 技術 | **Vite + Vue 3 + TypeScript + Element Plus + vue-i18n + Pinia + Vue Router + axios** |
| 位置 | monorepo 根目錄的 `admin/`（跟 `frontend/`、`backend/` 同一層） |
| 本機 | http://localhost:3200（`strictPort`，避開遊戲端的 3100） |
| i18n | zh-TW、en；Element Plus 元件的語系跟著切換（`el-config-provider`） |
| 型別 | 跟遊戲端一樣從 `docs/api/openapi.json` 用 openapi-typescript 產生（`npm run gen:api`），只會用到 `/api/admin/**` |
| 圖表 | Recharts 是 React 專用，Vue 用 ECharts（`vue-echarts`）之類的 |
| 開發的 Claude session | 建議另開一個在 `admin/` 啟動的 session，並有自己的 `admin/CLAUDE.md`（跟 `frontend/`、`backend/` 一樣讀根目錄 + 子目錄的 `CLAUDE.md`） |

### 怎麼連後端（重要）

管理員的登入是 **HttpOnly cookie `tl_admin_token`**（`Path=/api/admin`、`SameSite=Lax`），JS 讀不到 token，瀏覽器會自動帶。**前提是 API 請求跟頁面是同一個來源**，所以：

| 環境 | 做法 |
|---|---|
| 本機 | Vite 的 `server.proxy` 把 `/api` 轉到 `http://localhost:8088`；axios 的 `baseURL` 用相對路徑 `/api`。瀏覽器只跟 `localhost:3200` 說話，cookie 正常、不需要 CORS |
| 上線 | 跟遊戲端一樣放 Vercel（另一個 Vercel 專案，Root Directory `admin`），`vercel.json` 用 rewrites 把 `/api/:path*` 轉到 Render 的後端；另外加一條 SPA fallback（其他路徑都回 `index.html`） |

**不要讓瀏覽器直接打 `https://…onrender.com`**：那是跨站請求，`SameSite=Lax` 的 cookie 不會被帶上，登入後每個請求都會是 401；改成跨站 cookie（`SameSite=None`）又要處理 CSRF。用 proxy / rewrites 最簡單。

### 前端要處理的

- 啟動時打 `GET /api/admin/auth/me`：成功就知道是誰、什麼角色（存在 Pinia）；`401` 就導去登入頁
- 任何請求收到 `40100`（沒登入 / 過期）、`40102`（被別處登入踢掉）→ 清掉 Pinia 的登入狀態、導去登入頁
- 選單和路由依角色顯示 / 擋住（只是體驗，**真正的權限檢查在後端**，`VIEWER` 打 `SUPER_ADMIN` 的 API 會收到 `40300`）
- 錯誤依 `code` 翻譯；`40001` 的 `[{ field, rule }]` 對應到 Element Plus 表單欄位的錯誤
- 時間是 UTC ISO 字串，顯示時轉成本地時區；分頁的 `page` 從 1 開始，可以直接對 `el-pagination` 的 `current-page`
- 角色、審計動作、期數狀態都是 enum 代碼，翻譯放在 i18n

## 權限

| 角色 | 儀表板、期數監控 | 玩家管理、注單查詢（階段 C） | 管理員帳號、審計日誌 |
|---|---|---|---|
| `VIEWER` | ✅ | | |
| `OPERATOR` | ✅ | ✅ | |
| `SUPER_ADMIN` | ✅ | ✅ | ✅ |

## 階段

| 階段 | 內容 | 狀態 |
|---|---|---|
| A | 管理員登入與權限、管理員帳號管理、審計日誌 | 進行中 |
| B | 儀表板、期數監控（唯讀） | |
| C | 玩家管理（搜尋、詳情、停用 + 踢下線、手動調整積分）、注單查詢 | |
| D | 遊戲設定（從資料庫讀、下一期生效）、公告 / 維護模式 | |
| E | 報表、CSV 匯出 | |

## 階段 A + B 的 API（規劃）

| 方法 | 路徑 | 角色 | 審計 |
|---|---|---|---|
| POST | `/api/admin/auth/login` | 不用登入 | ✅ 成功、失敗 |
| POST | `/api/admin/auth/logout` | 任何 | |
| GET | `/api/admin/auth/me` | 任何 | |
| GET | `/api/admin/admins` | SUPER_ADMIN | |
| POST | `/api/admin/admins` | SUPER_ADMIN | ✅ |
| PATCH | `/api/admin/admins/{id}` | SUPER_ADMIN | ✅ |
| GET | `/api/admin/audit-logs` | SUPER_ADMIN | |
| GET | `/api/admin/dashboard/summary?from&to` | 任何 | |
| GET | `/api/admin/dashboard/trend?days=14` | 任何 | |
| GET | `/api/admin/draws?status&page&size` | 任何 | |
| GET | `/api/admin/draws/{drawNo}` | 任何 | |

儀表板：投注額（`BET` 流水）、派彩（`PAYOUT`）、系統盈虧、回收率、發出的註冊 / 簽到積分、新註冊、下注人數、注單數 / 注數 / 各玩法佔比、目前彩池、每天的趨勢。

期數監控：每期的狀態、時間、號碼、投注額、派彩、注單數、中獎人數；開獎超過 1 分鐘還是 `DRAWN` 的標成卡住。

## 後端步驟

| 步驟 | 內容 | 新學的東西 |
|---|---|---|
| A1 | `Admin` model、Repository、啟動時建立第一個管理員 | `ApplicationRunner`、設定類別 |
| A2 | 管理員登入、JWT、Redis session、cookie、第二條 filter chain | 多條 `SecurityFilterChain`、`securityMatcher`、`@Order` |
| A3 | 角色權限 + 管理員帳號管理 API | `@EnableMethodSecurity`、`@PreAuthorize` |
| A4 | 審計日誌 | 自訂註解 + AOP 切面 |
| B1 | 儀表板 | 依日期分組的聚合、跨模組組合 |
| B2 | 期數監控 | 多條件分頁查詢 |
