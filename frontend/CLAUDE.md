@AGENTS.md

# 前端（Next.js）

共同約定見根目錄 [../CLAUDE.md](../CLAUDE.md)（語言、決策、前後端協作流程）。這裡只放前端自己的約定。
上面的 `@AGENTS.md` 是 Next.js 自動生成的規則：這個版本有破壞性變更，寫代碼前先查 `node_modules/next/dist/docs/`。

用戶本身是前端工程師，前端部分可以直接討論方案和取捨。

## 技術棧

| 類別 | 目前 | 之後加入（用到時再加） |
|---|---|---|
| 框架 | Next.js 16.4（App Router）、React 19.3、TypeScript | |
| 樣式 | Tailwind CSS 4 | shadcn/ui |
| 伺服器數據 | — | TanStack Query |
| 客戶端狀態 | — | Zustand（選號、待下注列表） |
| 表單 | — | React Hook Form + Zod |
| API 類型 | — | openapi-typescript（從 `../docs/api/openapi.json` 生成） |
| 即時連線 | — | @stomp/stompjs（開獎倒數、開獎結果） |
| 動畫 | — | 開獎舞台：React Three Fiber + matter.js（見 [../docs/draw-animation.md](../docs/draw-animation.md)）；UI 動畫：Motion（只用這一個動畫庫） |
| 國際化 | — | 繁體中文（預設）、英文；方案在 i18n 骨架步驟決定 |
| 圖表 | — | Recharts（冷熱號碼、後台儀表板） |
| 測試 | — | Vitest + Playwright |

## 目錄約定（暫定）

```
src/
├── app/
│   ├── (game)/        玩家頁面：大廳、選號下注、開獎結果、我的注單
│   ├── (auth)/        登入、註冊
│   └── admin/         管理後台（階段 3）
├── components/        共用組件
├── features/          按功能分：betting/、draw/、wallet/ …
├── lib/
│   ├── api/           API 請求封裝（統一處理 { code, msg, data }）
│   └── ws/            WebSocket 連線
└── types/api.d.ts     由 OpenAPI 生成，不要手改
```

## 和後端對接

- 開始工作前先看 [../docs/api-changelog.md](../docs/api-changelog.md)。
- HTTP 請求一律用相對路徑 `/api/...`：開發時由 `next.config.ts` 轉發到 `http://localhost:8088`，沒有 CORS 問題。
- WebSocket 直連 `NEXT_PUBLIC_WS_URL`（預設 `ws://localhost:8088/ws`）。
- 回應格式 `{ code, msg, data }`，`code = 0` 成功；401 跳登入頁；其他錯誤顯示 `msg`。
- 時間是 UTC ISO 字串，顯示時轉本地時區；倒數以**後端給的時間點**為準，不要只靠前端計時。

## 介面原則

- 響應式、手機優先。
- 開獎結果在開獎時間就確定，動畫只是展示；切換分頁、重新整理後要能直接顯示結果。
- 尊重 `prefers-reduced-motion`：用戶關閉動畫時直接顯示號碼。
- 遊戲端所有文字都走 i18n（繁中、英文），不寫死在組件裡；管理後台之後再決定。
- 同一頁只放一個 WebGL 場景（開獎頁已有 3D 舞台，不再加 WebGL 背景效果）。
- 從 React Bits、Aceternity、Uiverse 借來的效果組件放 `src/components/fx/`，改用專案的 design token，並補上 reduced-motion 處理。

## 遊戲端開發順序

每一步完成後由用戶 review、commit、push，再進行下一步。

0. ✅ 開獎動畫方案文件、原型
1. i18n 骨架（繁中 / 英文、`[locale]` 路由）
2. Design token + 號碼球組件
3. 選號盤 + 待下注列表
4. 大廳 / 開獎頁（3D 舞台搬進 Next.js）
5. 中獎提示、積分滾動等效果

## 常用命令

```powershell
npm run dev       # http://localhost:3000
npm run build
npm run lint
```
