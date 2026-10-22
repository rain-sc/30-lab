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
| 伺服器數據 | TanStack Query 5（`src/lib/query/QueryProvider.tsx`；開獎紀錄、補查、錢包、注單、下注、頭獎彩池） | |
| 客戶端狀態 | Zustand（選號、待下注、登入的使用者、期數資料） | |
| 表單 | React Hook Form + Zod 4 | |
| API 類型 | openapi-typescript（`npm run gen:api`，從 `../docs/api/openapi.json` 生成 `src/types/api.d.ts`） | |
| 即時連線 | @stomp/stompjs 7（`src/lib/ws/client.ts`；「別台裝置登入」通知、期數 / 開獎推播 `/topic/draws`） | |
| 動畫 | Motion 14（UI 動畫唯一的動畫庫；`MotionProvider` 設定 `reducedMotion="user"`）；開獎舞台 three.js + matter.js（`features/draw/stage/`） | |
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
├── features/          按功能分：auth/、draw/（倒數、期數時間表、開獎號碼、冷熱）、betting/（選號盤、待下注、注單）、lobby/（大廳）、game/（頁首、底部分頁）…
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
- 大廳是設計稿 **D「看板 + 邊看邊玩」**：https://claude.ai/artifact/MBxLH6FWkuW8KrSsAsKmsb，桌面排版是同一份畫布的 **E2**：舞台和選號盤在第一屏並排（xl 三欄、md 兩欄，用 `grid-template-areas` 切換），積分只放在頁首
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
| `fx/CountUp` | React Bits Count Up（改用 next-intl 數字格式） | 頭獎彩池進場累加、中獎金額累加 |
| `fx/RollingNumber` | — | 積分從舊值滾到新值（下注扣款、派彩）；直接改 DOM 文字，不重新渲染 |
| `wallet/BalanceDelta` | — | 積分旁浮出「+40」「−20」往上飄 |
| `game/DrawNotices` | — | 開獎結果通知：中獎金色卡片 + 火花 + 獎金累加（頭獎到三獎更大），沒中獎小卡片 |
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
- 登入狀態是後端的 HttpOnly cookie（`msl_token`），前端 JS 不碰 token。`api` 收到 `40100`（未登入 / 過期）或 `40102`（被別處登入踢掉）會**整頁導向** `/login`（原因 `expired` / `replaced` 存在 sessionStorage，不放網址上，登入頁的 `SessionNotice` 讀取顯示）；只查狀態的請求（例如 `GET /me`）傳 `{ redirectOnUnauthorized: false }` 自己處理（這個選項已擴充進 axios 的 config 型別）。
- **登出的規則**（分頁與裝置）：
  - 同一個瀏覽器的分頁共用 cookie，後端分不出是哪個分頁，所以由前端處理：**同一個瀏覽器裡最後登入的分頁才能使用帳號，其他分頁變成登出**
    - 通知：登入成功時用 `BroadcastChannel` 廣播（`lib/api/tabSession.ts`），其他分頁導向 `/login`（原因 `other-tab`）
    - 記住：`sessionStorage`（每個分頁各自一份）記「此分頁已登出」；標記還在時，axios 請求攔截器擋下登入、註冊以外的請求（當成 `40100`），重新整理、點 logo 回首頁也不會變回已登入。重新登入時清掉
  - 別台裝置登入同一個帳號：後端透過 WebSocket 推 `SESSION_REPLACED` → 導向 `/login`（原因 `replaced`）（等 0.5 秒，讓同瀏覽器的分頁廣播先處理，提示才不會誤報成「其他地方登入」）
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
- 所有資料都來自後端，前端沒有示例資料。之後如果又需要暫時的示例資料，畫面上必須標示「示例數據」。

## 遊戲端頁面

- 路由群組 `[locale]/(game)/`：`/` 大廳、`/trends` 冷熱號碼、`/history` 開獎紀錄、`/bets` 我的注單（含積分紀錄分頁籤）、`/leaderboard` 排行榜、`/rules` 玩法說明（只在桌面導覽；手機入口在選號盤的「?」、彩池卡片、使用者選單）。
  桌面用頁首導覽（冷熱號碼放在大廳最下方，不在導覽裡）；手機用底部分頁（五個都有，內容區要留出分頁和下注列的高度）。
  手機頁首很擠（logo、簽到、積分、選單）：新增東西前先確認 360px 寬不會被撐寬（`document.documentElement.scrollWidth`）
- **要登入**：版面裡的 `GameSessionGate` 打 `GET /me`，未登入導向 `/login`（不帶原因），被踢掉帶 `replaced`，連不上顯示重試。
  確認前頁面內容**照樣渲染、只是用 `hidden` 藏起來**：不渲染的話 Next 16.4 的 instant navigation 驗證會報「segment was dropped」。所以頁面內容在確認前不能打需要登入的 API。
- 登入的使用者放在 `useSession`（`features/auth/session.ts`），頁首、注單依 `username` 讀取。
- Zustand 的 `persist` store 一律 `skipHydration: true`，由 `GameSessionGate` 掛載後 `rehydrate()`：伺服器端沒有 storage，直接讀會 hydration 不一致。
  選號、待下注存 **sessionStorage**（每個分頁各自一份，和登入規則一致）。
- **下注**（`betting/usePlaceBets`，`POST /api/tickets`）：待下注的每一注一次送出 = 一張注單
  - `idempotencyKey`：每次確認下注產生新的；失敗原因不確定（網路、逾時、5xx）而且待下注沒變時沿用（後端不會重複扣款），同時重新抓積分和注單
  - 成功：用回應的 `balance` 直接更新錢包快取（`setQueryData`），invalidate `["tickets"]`、`["wallet-transactions"]`
  - `40903` 已截止 → `reloadCurrentDraw()`；`40902` 積分不足 → 重新抓錢包；每張最多 50 注（`MAX_LINES`，待下注滿了不能再加）
- **積分**：`GET /api/wallet`（`wallet/api.ts` 的 `useWallet`）；載入失敗時頁首變成重試按鈕
  - **畫面上的積分用 `useBalance`**：= 錢包餘額 − 還沒播完開獎動畫那幾期的 `payout`（派彩在開獎後約 1 秒就完成，比動畫早 20 幾秒，不能先漲）
- **遊戲規則**（`features/draw/rules.ts`，`GET /api/game/rules`）：每注積分、每期間隔、截止秒數、每張上限、每注幾個號碼、號碼範圍、獎金、彩池規則、贈送積分。**不要再寫死這些數字**：React 用 `useGameRules()`，非 React（選號 store）用 `currentRules()`；回應前是 `DEFAULT_RULES`，「玩法說明」頁用 `useGameRulesQuery()` 等真的資料
- **排行榜**（`features/leaderboard`，設計稿 F）：`GET /api/leaderboard?period=DAY|WEEK`；queryKey 帶期間、帳號、`revealedDrawAt`，**動畫播完才抓**（`latestRevealed` 為 false 時不抓）；倒數到 `to` 時重抓；暱稱會重複，不能當 key
- **每日簽到**（`wallet/dailyBonus.ts`、`DailyBonusButton`，頁首積分旁邊）：每個 UTC 日一次；成功用回應的 `balance` 更新錢包快取；`40904` 當成「已簽到」（不顯示錯誤，重新抓狀態和積分）；到 `nextResetAt` 自動重抓，跨日後按鈕恢復。手機頁首只在沒簽到時顯示禮物圖示（放文字會把頁面撐寬），已簽到的狀態在使用者選單裡
- **我的注單 / 積分紀錄**（`/bets`，分頁籤切換）：`GET /api/tickets`、`GET /api/wallet/transactions`，都分頁
  - 每注的獎級、獎金用後端的 `results`（和 `lines` 一一對應，`tier` 沒中獎時不存在）、注單的 `payout`；獎級名稱在 `Tier` 翻譯
  - **中獎結果等開獎動畫播完才顯示**（`revealedAt`）：之前顯示「待開獎」，過了還是 `PENDING` 顯示「結算中」；開獎通知也一樣
  - 注單沒有開獎時間：用 `schedule.ts` 的 `drawAtOf(期數號)` 算（後端的規則：UTC、第 N 個 5 分鐘）
- **期數資料**（`features/draw/feed.ts`，[locale]/layout 的 `DrawFeed` 啟動，登入頁也用）：`GET /api/draws/current` + `/topic/draws` 推播
  - 推播 `OPENED` / `CLOSED` / `DRAWN` / `SETTLED`；**收到 `SETTLED`（派彩已完成）→ invalidate 注單、錢包、積分紀錄、彩池、開獎紀錄**（`DrawFeed`）
  - 時鐘用 `serverTime` 校正：時間一律用 `feedNow()` / `useNow()`，不要直接 `Date.now()`
  - 期數依 `drawNo` 存：「目前這期」= 開獎時間最晚的、「上一期」= 有號碼的期數裡最晚的（後端重啟會補送過期事件，不能假設收到的就是目前這期）
  - 號碼開獎前**欄位不存在**（不是 null），用 `hasResult()` 判斷；`numbers` 是開出順序，顯示時自己排序
  - 收到的開獎號碼存在 localStorage（`useDrawFeed` 的 `results`），對獎、開獎紀錄用
  - 重抓時機：WebSocket 重連（`onWsConnect`）、分頁切回來、看門狗（過了開獎時間 5 秒還沒收到推播）；抓不到時 `status === "error"`，大廳顯示 `DrawFeedError`
  - 期數號由後端決定（UTC），前端不推算
- **頭獎彩池**（`draw/jackpot.ts` 的 `useJackpot`、`JackpotAmount`）：`GET /api/jackpot`，進頁面、`SETTLED`、自己下注成功、每 30 秒重抓；**不能在 `OPENED` 時抓**（上一期還沒結算完）；`drawNo` 和目前這期不同時不顯示
- **開獎紀錄**（`GET /api/draws`，`useDrawHistory`）：大廳近期開獎、開獎紀錄頁（分頁）
- **冷熱號碼**（`GET /api/draws/number-stats?window=100`，`draw/HotCold.tsx` 的 `useHotCold`）：熱門用 `count + specialCount` 排序、冷門用 `missed`；queryKey 帶 `revealedDrawAt`，**動畫播完才抓**，`latestRevealed` 為 false（動畫播放中）時不抓、沿用上一份
  - 結算後每期有 `poolAmount`、`jackpotWinners`，開獎紀錄顯示「彩池・有沒有人中頭獎」
  - queryKey 帶 `revealedDrawAt`：新的一期公布時自動重抓；列表濾掉還沒公布的期數（不劇透）
  - 期數號可能不連續（後端停機期間沒有期數），不要用期數號推算前後期
  - 拿到的號碼也記進 `useDrawFeed` 的 `results`
- **補查開獎號碼**（`draw/useResultBackfill`，我的注單每一頁呼叫）：開獎時不在線上的期數，用開獎紀錄往回查；查不到的標成 `missing`，我的注單顯示「查不到」
- **TanStack Query 和 Zustand 的分工**：後端來、要快取 / 分頁 / 重抓的資料用 Query；只存在前端的狀態（選號、待下注）和推播即時更新的期數用 Zustand
- 截止下注後「確認下注」停用，下一期開始自動恢復
- **開獎舞台**（`features/draw/stage/`）：
  - `timeline.ts`：純函數 `stagePhaseAt(現在時間, { current, previous })` → 可下注 / 攪珠（截止後，或推播晚到還沒收到號碼）/ 開獎中（第幾顆、播了多久），號碼帶在階段資料裡。動畫進度完全由時間算出，重新整理、切回分頁都接著播；引擎每一幀呼叫 `getPhase()`
  - `engine.ts`：three.js + matter.js（原型 `docs/prototypes/draw-stage.html` 改寫成 TS），**用純 three.js，不用 React Three Fiber**（原型的邏輯幾乎原封不動）。
    three r186 的差異：光照強度乘 π、`SRGBColorSpace`、`PCFSoftShadowMap` 已移除
  - `DrawStage.tsx`：動態 `import("./engine")`（three + matter 不進初始 JS），載入前顯示 `StagePreview`；effect 清除時 `dispose()` 釋放 WebGL（Activity 隱藏頁面也會執行），**每次重建都用新的 canvas**（`forceContextLoss` 後同一個 canvas 不能再用）
  - 捲出畫面、切到別的分頁時暫停渲染和物理
  - **一頁只掛一個 WebGL**：桌面掛在大廳的舞台卡片；手機平常是靜態縮圖，點一下或截止到開完獎時自動放大成全畫面才掛（`MobileStage`，用 portal 放到 body，外層有 transform 時 fixed 會失效）。用 `useIsDesktop()` 決定掛哪一個，CSS 的 `hidden` 只是藏起來、元件還在
  - reduced-motion：不攪珠、不播開球、手機不自動放大，開獎一到直接擺好
- **結果等動畫播完才公布**（開獎後 25 秒，`revealedAt`）：開獎紀錄、冷熱號碼用 `NextDraw.revealedDrawAt`，注單對獎、積分也等到這個時間，列表不會比舞台先劇透
- **開獎結果通知**（`DrawNotices`，放在遊戲端版面，任何遊戲頁都會收到）：自己有下注的期數在 `revealedAt` 跳出；只通知打開頁面**之後**才公布的期數（重新整理不重複）。中獎卡片停 9 秒、沒中獎 5 秒，滑鼠移上去暫停
- 頁首 `sticky`：捲動時也看得到積分的變化

## 遊戲端開發順序

每一步完成後由用戶 review、commit、push，再進行下一步。

0. ✅ 開獎動畫方案文件、原型
1. ✅ i18n 骨架（繁中 / 英文、`[locale]` 路由）
2. ✅ 登入 / 註冊頁（順帶完成 design token、號碼球、表單基礎元件）；已接上後端帳戶 API，成功後進大廳
3. ✅ 大廳（設計稿 D）+ 選號盤 + 待下注列表 + 冷熱 / 開獎紀錄 / 我的注單（當時用示例資料，2026-10-21 已全部接上後端）
4. ✅ 3D 開獎舞台搬進大廳（npm 的 three.js + matter.js；手機開獎時舞台自動放大）
5. ✅ 中獎提示、積分滾動等效果

## 常用命令

```powershell
npm run dev       # http://localhost:3100；手機等其他裝置用區網 IP（例如 http://192.168.0.171:3100）
npm run build
npm run lint
```

- 用區網 IP 開 dev server 時，`next.config.ts` 的 `allowedDevOrigins` 要允許那個主機名稱（目前允許 `192.168.*.*`），不然開發用的 JS 會被擋掉，頁面無法互動。
