@AGENTS.md

# 前端（Next.js）

共同約定見根目錄 [../CLAUDE.md](../CLAUDE.md)（語言、決策、前後端協作流程）。這裡只放前端自己的約定。
上面的 `@AGENTS.md` 是 Next.js 自動生成的規則：這個版本有破壞性變更，寫代碼前先查 `node_modules/next/dist/docs/`。

用戶本身是前端工程師，前端部分可以直接討論方案和取捨。

## 技術棧

| 類別 | 目前 | 之後加入（用到時再加） |
|---|---|---|
| 框架 | Next.js 16.4（App Router）、React 19.3、TypeScript | |
| 樣式 | Tailwind CSS 4（design token 在 `src/app/globals.css`）、clsx + tailwind-merge（`cn()`） | shadcn/ui |
| HTTP 請求 | axios（`src/lib/api/client.ts` 的 `api`，所有 API 都用它） | |
| 伺服器數據 | — | TanStack Query |
| 客戶端狀態 | — | Zustand（選號、待下注列表） |
| 表單 | React Hook Form + Zod 4 | |
| API 類型 | openapi-typescript（`npm run gen:api`，從 `../docs/api/openapi.json` 生成 `src/types/api.d.ts`） | |
| 即時連線 | @stomp/stompjs 7（`src/lib/ws/client.ts`；目前用於「別台裝置登入」通知） | 開獎倒數、開獎結果 |
| 動畫 | Motion 14（UI 動畫唯一的動畫庫；`MotionProvider` 設定 `reducedMotion="user"`） | 開獎舞台：React Three Fiber + matter.js（見 [../docs/draw-animation.md](../docs/draw-animation.md)） |
| 國際化 | next-intl 4（繁體中文 `zh-TW` 預設、英文 `en`） | |
| 圖表 | — | Recharts（冷熱號碼、後台儀表板） |
| 測試 | — | Vitest + Playwright |

## 目錄約定（暫定）

```
src/
├── app/
│   ├── [locale]/          根佈局在這裡（語系是根參數）
│   │   ├── (game)/        玩家頁面：大廳、選號下注、開獎結果、我的注單
│   │   ├── (auth)/        登入、註冊
│   │   ├── not-found.tsx  語系內的 404（有翻譯）
│   │   └── [...rest]/     接住不存在的路徑 → not-found
│   ├── admin/             管理後台（階段 3，是否走 i18n 之後再定）
│   └── global-not-found.tsx  完全對不上路由時的 404（中英並列）
├── components/        共用組件（Ball 號碼球、BrandLogo、LocaleSwitcher）
│   ├── ui/            基礎元件：Button、Input、PasswordInput、Field
│   └── fx/            動畫效果組件（參考 React Bits / Aceternity / Uiverse，檔頭註明來源）
├── features/          按功能分：auth/、draw/（直播面板、倒數、規則常數）、betting/、wallet/ …
├── i18n/
│   ├── routing.ts     語系列表、預設語系、cookie
│   ├── navigation.ts  Link / redirect / useRouter（自動帶語系前綴）
│   ├── request.ts     每個請求載入對應的翻譯檔
│   └── messages/      zh-TW.json、en.json
├── lib/
│   ├── api/           API 請求封裝（統一處理 { code, msg, data }）
│   └── ws/            WebSocket 連線
├── proxy.ts           Next 16 的 proxy（舊名 middleware）：沒有語系前綴的網址導向 /zh-TW 或 /en
└── types/api.d.ts     由 OpenAPI 生成，不要手改
```

## i18n 規則

- 網址一律帶語系前綴：`/zh-TW/...`、`/en/...`。進站時依 cookie → 瀏覽器語言 → 繁中決定語系；進過某個語系就用 cookie 記住一年。
- 頁面跳轉用 `@/i18n/navigation` 的 `Link`、`useRouter`、`redirect`，**不要**直接用 `next/link`（會丟掉語系前綴）。
- 文字用 `useTranslations("命名空間")`，Server / Client Component 都能用；async Server Component 和 `generateMetadata` 用 `getTranslations`。
- 新增文字時，`zh-TW.json` 和 `en.json` **同時加**。型別以 `zh-TW.json` 為準（`src/global.d.ts`），key 打錯會編譯失敗。
- 複數、數字、日期用 ICU 語法和 `useFormatter`，不要自己拼字串（例如 `{count, plural, one {# ticket} other {# tickets}}`）。
- 語系是根參數，Server 端由 `next/root-params` 讀取，不用一層層傳 `locale`。

## 視覺風格與 Design token

- 遊戲端風格是設計稿 **A「開獎直播間」**：https://claude.ai/artifact/YHfuLPTV2Q42BuurgpKw3A
  新頁面先在設計稿畫布上畫好、確認，再實作；不要直接在程式碼裡堆效果。
- 原則：深墨藍底、**只有一個強調色（金色）**；號碼球的紅藍綠只出現在球上；資訊本身就是視覺主角（大字倒數、彩池）。
- **背景、氛圍類效果最多一個**（粒子、極光、球池這類）；上一版堆了六個裝飾效果，結果又雜又醜。
  但**回應操作、傳遞資訊的動畫**可以多用：數字變化、元素進場、hover、分頁切換、錯誤回饋。
- token 定義在 `src/app/globals.css` 的 `@theme`，會自動生成 class（`--color-gold` → `bg-gold`、`text-gold`…）：
  底色 `stage` → 輸入框 `sunken` → 卡片 `panel`、邊框 `line` / `line-strong`、文字 `fg` / `fg-soft` / `muted`、強調 `gold`、直播 `live`、號碼球 `ball-red` / `ball-blue` / `ball-green`。
- 組件一律用 token，**不要寫死顏色值**；字體用 `font-sans`（Noto Sans TC）、數字和品牌字用 `font-num`（Barlow Condensed）。
- 號碼球一律用 `<Ball number={n} />`（特別號碼加 `special`），波色由 `src/lib/ball.ts` 決定，全站外觀一致。
- Tailwind 靠**靜態掃描**原始碼產生 class：任意值 class 要寫成一整段字串，不能用 `+` 拆開拼接，否則不會生成。

## 動畫

| 組件 / 做法 | 參考來源 | 用在 |
|---|---|---|
| `fx/RollingDigits` | React Bits Counter（原版違反 hook 規則、秒數十位會倒滾，自己重寫） | 開獎倒數每秒滾動 |
| `fx/CountUp` | React Bits Count Up（改用 next-intl 數字格式） | 頭獎彩池進場累加 |
| `fx/SpotlightCard` | React Bits Spotlight Card（只保留核心，CSS 變數） | 表單卡片游標聚光燈 |
| `fx/ClickSpark` | React Bits Click Spark（Canvas 改成 CSS） | 送出按鈕點擊火花 |
| `Button` primary 的 `before:` 光澤 | Uiverse shine button | 按鈕 hover |
| `AuthTabs` 的滑動底塊 | Aceternity Tabs | 登入 / 註冊切換 |
| `Field` 的 `shakeSignal` | — | 送出失敗時錯誤欄位輕晃 |
| `LivePanel` 的 `AnimatePresence` | — | 開獎球依序掉落、換期時滾走換新 |
| `animate-fade-up` + `animation-delay` | React Bits Animated Content | 頁面區塊依序進場（純 CSS） |
| `fx/BokehBalls` | React Bits Particles（圓點換成號碼球、CSS blur 做景深） | 登入頁背景：模糊漂浮的號碼球 + 滑鼠視差（**這頁唯一的背景氛圍效果**） |

- 能用 CSS 的用 CSS（進場、光澤、火花、脈動）；需要狀態、彈簧、進出場的用 Motion。
- **伺服器渲染的內容不要用 JS 動畫從透明開始**（JS 慢的話畫面會空白），進場用 CSS 動畫。
- 會重新掛載輸入框的做法不能用來做動畫（會清掉 React Hook Form 的值），改用 Web Animations API（`element.animate`）。
- Motion 的 `layoutId` 用畫面絕對位置計算起點，父層會移動時（例如卡片高度改變重新置中）會飛出去；這種情況改用相對父層的 `x` 位移。
- **Next 16 的 `cacheComponents` 不會卸載離開的頁面**，而是用 `<Activity>` 隱藏保留（最多 3 個路由）。回到同一個網址時元件不會重新掛載，只靠「掛載時播放」的進場動畫不會重播。
  處理方式：在 `useLayoutEffect` 的清除函式（頁面被隱藏時執行）換一個 `key`，回來時該區塊重新掛載（見 `LivePanel` 的 `replayKey`）。
  寫在 effect 裡的動畫（`CountUp`）和 CSS 動畫本來就會重播。
  另外 Playwright 測試時，被隱藏的頁面還在 DOM 裡，選擇器要過濾可見元素。詳見 `node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md`。
- reduced-motion：Motion 由 `MotionProvider` 統一處理；CSS 動畫加 `motion-reduce:animate-none`；`CountUp`、`ClickSpark`、`Field` 晃動各自判斷。

## 借用外部效果組件（React Bits、Aceternity、Uiverse）

- 先在設計稿確認真的需要，再引入；放 `src/components/fx/`，檔頭註明來源、授權、改了什麼。
- 引入前先檢查：依賴有多大、手機效能、有沒有處理 reduced-motion、觸控會不會攔截底下的操作、能不能通過專案的 TypeScript 和 React 19 lint。
- React Bits 是 MIT + Commons Clause：可用於自己的作品，不可單獨販售或重新散布組件本身。

## 表單

- React Hook Form + Zod，`mode: "onTouched"`（離開欄位才檢查）。
- Zod 4 的錯誤參數用 `error`（`message` 已 deprecated）。schema 裡存**翻譯 key**，由組件翻譯，schema 不依賴語系。
- 欄位用 `<Field>` 包起來，它會把 label、說明、錯誤和輸入框用 `aria-describedby` 關聯好。
- `<form>` 一律加 `method="post"`：JS 還沒載入或載入失敗時，表單會由瀏覽器原生送出，預設的 GET 會把欄位（包括密碼）放進網址。

## 和後端對接

- 開始工作前先看 [../docs/api-changelog.md](../docs/api-changelog.md)，契約有變就 `npm run gen:api`；型別一律從 `@/types/api` 的 `components["schemas"]` 取，不要自己手寫。
- HTTP 請求**一律用 `@/lib/api/client` 的 `api`**（axios 封裝），不要直接用 `fetch` 或另外建 axios 實例：
  `api.get<User>("/auth/me")`、`api.post<User>("/auth/login", body)`、`put` / `patch` / `delete` 同理；回傳值已經是後端的 `data`，型別從 `@/types/api` 取。
  `baseURL` 是 `/api`：開發時由 `next.config.ts` 轉發到 `http://localhost:8088`，同源、沒有 CORS 問題，cookie 自動帶上。
- 回應 `{ code, msg, data }` 由 axios 攔截器統一處理：`code = 0` 回傳 `data`；其他丟出 `ApiError`（帶 5 位數錯誤碼 `code`、`status`、`fieldViolations`）。
  **逾時 10 秒**、連不到伺服器 → `NETWORK_ERROR`；回應不是後端格式（例如後端掛了，轉發回傳 HTML）→ HTTP 狀態碼的通用碼（`502` → `50200`，翻譯時退回 `50000`）。畫面只需要處理 `ApiError` 一種錯誤。
  所有「載入中」的畫面都要有錯誤狀態和下一步（重試、前往登入…）：沒有逾時的話，後端卡住時畫面會永遠停在載入中。
- **錯誤訊息由前端翻譯**：`useApiErrorText()(error)` 依 `code` 查 `messages` 的 `ApiErrors`，找不到就用前 3 碼的通用碼（`40900` → `40000` / `50000`）。後端的 `msg` 不直接顯示給使用者。
  新的錯誤碼出現時，`zh-TW.json`、`en.json` 的 `ApiErrors` 同時加。
- 欄位錯誤（`40001`）：用 `applyFieldViolations` 把 `field` + `rule` 對應到表單的錯誤 key，顯示在欄位下；不屬於欄位的錯誤用 `<FormAlert>` 顯示在表單上方。
- 登入狀態是後端的 HttpOnly cookie（`msl_token`），前端 JS 不碰 token。`api` 收到 `40100`（未登入 / 過期）或 `40102`（被別處登入踢掉）會**整頁導向** `/login?reason=expired|replaced`；只查狀態的請求（例如 `GET /me`）傳 `{ redirectOnUnauthorized: false }` 自己處理（這個選項已擴充進 axios 的 config 型別）。
- **登出的規則**（分頁與裝置）：
  - 同一個瀏覽器的分頁共用 cookie，後端分不出是哪個分頁，所以由前端處理：**同一個瀏覽器裡最後登入的分頁才能使用帳號，其他分頁變成登出**
    - 通知：登入成功時用 `BroadcastChannel` 廣播（`lib/api/tabSession.ts`），其他分頁導向 `/login?reason=other-tab`
    - 記住：`sessionStorage`（每個分頁各自一份）記「此分頁已登出」；標記還在時，axios 請求攔截器擋下登入、註冊以外的請求（當成 `40100`），重新整理、點 logo 回首頁也不會變回已登入。重新登入時清掉
  - 別台裝置登入同一個帳號：後端透過 WebSocket 推 `SESSION_REPLACED` → 導向 `/login?reason=replaced`（等 0.5 秒，讓同瀏覽器的分頁廣播先處理，提示才不會誤報成「其他地方登入」）
  - 被登出時**不呼叫 logout API**（cookie 屬於新登入的那一邊）；`redirectToLogin` 只跳轉一次，已在登入頁就不跳
  - **正在登入 / 註冊的分頁忽略 `SESSION_REPLACED`**：推播比登入回應（新 cookie）早到，不忽略的話自己登入完會被踢回登入頁
  - 處理這些通知的是 `[locale]/layout` 的 `SessionGuard`
- WebSocket（`@/lib/ws/client`）：全站一條 STOMP 連線，**已登出的分頁不連線**；登入、註冊、登出後 `restartWs()`（`force` 立刻重連，後端才會用新 cookie 識別身分）；斷線自動重連、每次連上自動重新訂閱。訂閱用 `subscribeWs(destination, handler)`，回傳取消訂閱的函式
- Server Component 呼叫後端時，瀏覽器的 cookie 不會自動帶過去，要用 `cookies()` 取出 `msl_token` 放進 `Cookie` header（目前還沒有這種用法）。
- WebSocket 直連 `NEXT_PUBLIC_WS_URL`（預設 `ws://localhost:8088/ws`）。
- 時間是 UTC ISO 字串，顯示時轉本地時區；倒數以**後端給的時間點**為準，不要只靠前端計時。

## 介面原則

- 響應式、手機優先。
- 開獎結果在開獎時間就確定，動畫只是展示；切換分頁、重新整理後要能直接顯示結果。
- 尊重 `prefers-reduced-motion`：用戶關閉動畫時直接顯示號碼。
- 遊戲端所有文字都走 i18n（繁中、英文），不寫死在組件裡；管理後台之後再決定。
- 同一頁只放一個 WebGL 場景（開獎頁已有 3D 舞台，不再加 WebGL 背景效果）。
- 期數、彩池等資料在後端 API 完成前用 `src/features/draw/mock.ts` 的示例資料，畫面上必須標示「示例數據」。

## 遊戲端開發順序

每一步完成後由用戶 review、commit、push，再進行下一步。

0. ✅ 開獎動畫方案文件、原型
1. ✅ i18n 骨架（繁中 / 英文、`[locale]` 路由）
2. ✅ 登入 / 註冊頁（順帶完成 design token、號碼球、表單基礎元件）；已接上後端帳戶 API，成功後回首頁（大廳做好後改成導向大廳）
3. 選號盤 + 待下注列表
4. 大廳 / 開獎頁（3D 舞台搬進 Next.js）
5. 中獎提示、積分滾動等效果

## 常用命令

```powershell
npm run dev       # http://localhost:3100；手機等其他裝置用區網 IP（例如 http://192.168.0.171:3100）
npm run build
npm run lint
```

- 用區網 IP 開 dev server 時，`next.config.ts` 的 `allowedDevOrigins` 要允許那個主機名稱（目前允許 `192.168.*.*`），不然開發用的 JS 會被擋掉，頁面無法互動。
