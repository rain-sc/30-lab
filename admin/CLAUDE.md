# 後台前端（Vue）

30 Lab 的管理後台：管理員登入、儀表板、期數監控，之後是玩家管理、注單查詢、遊戲設定、報表（階段見 [../docs/admin.md](../docs/admin.md)）。
共同約定見根目錄 [../CLAUDE.md](../CLAUDE.md)（語言、決策、前後端協作流程）。這裡只放後台前端自己的約定。

> 這份是建立專案骨架時寫的初版，後台前端 session 開始工作後繼續補充、修改。

## 技術棧

| 類別 | 用什麼 |
|---|---|
| 建置 | Vite 8（`vite.config.ts`） |
| 框架 | Vue 3（`<script setup>` + TypeScript 5.9） |
| UI 元件 | Element Plus（語系跟著 i18n 切換：`el-config-provider`） |
| 路由 | Vue Router |
| 狀態 | Pinia（登入的管理員、角色） |
| HTTP | axios（統一處理 `{ code, msg, data }`，見下方「和後端對接」） |
| 國際化 | vue-i18n（zh-TW 預設、en） |
| API 型別 | openapi-typescript（`npm run gen:api`，從 `../docs/api/openapi.json` 產生 `src/types/api.d.ts`，不要手改） |
| 圖表 | 之後用 ECharts（`vue-echarts`）；Recharts 是 React 專用 |

- TypeScript 用 5.9（和遊戲端一致）：create-vite 預設的 TypeScript 6 和 openapi-typescript 7 的 peer dependency 衝突
- `@` 指向 `src/`（`vite.config.ts` 的 `resolve.alias`、`tsconfig.app.json` 的 `paths`）
- Node：Vue Router 5 間接用到的套件要求 **Node 22.18+**（低於這個版本 npm 會出 EBADENGINE 警告，目前還能跑）

## 怎麼跑

```powershell
npm install
npm run dev       # http://localhost:3200（strictPort，被占用就報錯）
npm run build     # vue-tsc 型別檢查 + 建置
npm run gen:api   # 後端改了 API 之後重新產生型別
```

需要後端（http://localhost:8088）和 MongoDB、Redis 已經啟動，見根目錄的 README。

## 和後端對接

- **一律打相對路徑 `/api`**：本機由 `vite.config.ts` 的 `server.proxy` 轉到 8088；上線由 Vercel 的 rewrites 轉到 Render。
  **不要讓瀏覽器直接打後端的網址**：跨站請求時 `SameSite=Lax` 的登入 cookie 不會被帶上，每個請求都會是 401（原因見 `docs/admin.md`「怎麼連後端」）
- 管理員登入是 HttpOnly cookie `tl_admin_token`（`Path=/api/admin`），JS 讀不到也不用碰；後台只用 `/api/admin/**`
- 回應是 `{ code, msg, data }`，`code = 0` 成功；其他是 5 位數錯誤碼。**錯誤訊息由前端依 `code` 翻譯**，`msg` 只是給開發看的
  - `40100`（沒登入 / 過期）、`40102`（被別處登入踢掉）→ 清掉登入狀態、導去登入頁
  - `40300` → 沒有權限（選單、路由依角色擋只是體驗，真正的權限檢查在後端）
  - `40001` 的 `[{ field, rule }]` 對應到 Element Plus 表單欄位的錯誤
- 時間是 UTC ISO 字串，顯示時轉本地時區；分頁 `page` 從 1 開始（可以直接接 `el-pagination` 的 `current-page`）
- 角色（`VIEWER` / `OPERATOR` / `SUPER_ADMIN`）、審計動作、期數狀態都是 enum 代碼，翻譯放在 i18n
- 開始工作前先看 [../docs/api-changelog.md](../docs/api-changelog.md) 有沒有【待後台前端】、契約有沒有變（變了就 `npm run gen:api`）；完成後在那裡回覆

## 從遊戲端學到的（同樣適用）

- 所有「載入中」的畫面都要有錯誤狀態和下一步（重試、前往登入…）；axios 設逾時，不然後端卡住時畫面會永遠停在載入中
- 表單的 `<form>` 加 `method="post"`，JS 沒載入時原生送出才不會把密碼放進網址
- 文字都走 i18n，zh-TW、en 同時加
