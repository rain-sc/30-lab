# API 變更記錄（前後端交接）

前端、後端在不同對話裡開發，這份文件是兩邊的**交接記錄**。

- **後端**：每次新增、修改、刪除 API，在最上面加一筆，並重新匯出 `docs/api/openapi.json`。
- **前端**：每次開始工作先看這裡，然後重新生成類型。
- 需要對方配合的事，標註 **【待前端】** 或 **【待後端】**，完成後改成 **【已完成】**。

格式：

```
## YYYY-MM-DD
- 【新增 / 修改 / 刪除】METHOD /api/xxx：說明
  - 前端要做什麼：……
```

---

## 2026-10-15（前端）
- 【待後端】`openapi.json` 裡的回應欄位全部是**可選的**（例如 `UserResponse` 生成出來是 `id?: string`、`username?: string`），前端每次使用都要處理 `undefined`
  - 後端一定會回傳的欄位，請在 `@Schema` 加上 `requiredMode = Schema.RequiredMode.REQUIRED`（`UserResponse` 的四個欄位、`Result` 的 `code` / `msg`），重新匯出契約
  - 前端要做什麼：重新 `npm run gen:api` 即可，不用改程式

## 2026-10-15
- 【新增】帳戶接口（回應 `data` 的型別見 `openapi.json` 的 `UserResponse`：`id`、`username`、`nickname`、`createdAt`）

  | 接口 | 需要登入 | 說明 |
  |---|---|---|
  | `POST /api/auth/register` | 否 | body `{ username, nickname, password }`；成功後**直接登入**（同時設 cookie），回傳使用者 |
  | `POST /api/auth/login` | 否 | body `{ username, password }`；回傳使用者 |
  | `GET /api/auth/me` | 是 | 目前登入的使用者；用來判斷登入狀態、重新整理後恢復使用者資料 |
  | `POST /api/auth/logout` | 否 | 一律 200，清掉 cookie；只有目前有效的 session 會被結束 |

  - **登入狀態**：JWT 放在 HttpOnly cookie `msl_token`（`Path=/`、`SameSite=Lax`、7 天），**token 不會出現在 response body**，前端 JS 讀不到也不需要碰
    - 瀏覽器端：請求走 Next.js 的 `/api/*` 轉發，屬於同源，cookie 會自動帶上，不用加 header
    - Server Component / Route Handler 在伺服器端呼叫後端時，瀏覽器的 cookie **不會自動帶過去**，要用 `cookies()` 取出 `msl_token` 自己放進 `Cookie` header
  - **同一帳號只能一個 session**：別處登入後，舊的 session 打需要登入的接口會收到 `401` + **`40102`**
  - 帳號**不分大小寫**，後端存小寫（`Rain_01` 回傳 `rain_01`）；暱稱會去掉頭尾空白
  - 欄位規則和前端 `schemas.ts` 一致。欄位錯誤（`40001`）可能出現的 `field` + `rule`：
    - 註冊：`username` → `notNull` / `pattern`；`nickname` → `notNull` / `size`；`password` → `notNull` / `size`
    - 登入：`username` → `notBlank`；`password` → `notEmpty`
  - 錯誤碼：`40101` 帳號或密碼錯誤（帳號不存在也是這個）、`40901` 帳號已被使用、`40100` 未登入 / 登入過期、**`40102` 帳號已在其他地方登入（新增）**
  - 【已完成】（前端 2026-10-15）
    - `frontend/src/features/auth/api.ts` 的模擬換成真的請求，重新 `npm run gen:api` 生成型別
    - 加 `errors.40102` 翻譯（zh-TW / en）
    - 任何接口收到 `40100` → 導向登入頁；收到 `40102` → 先提示「帳號已在其他地方登入」再導向登入頁
      （`lib/api/client.ts` 統一處理：整頁導向 `/login?reason=expired|replaced`，登入頁顯示對應提示）

## 2026-10-14
- 【修改】錯誤回應格式：`code` 改成 5 位數業務錯誤碼（之前是「和 HTTP 狀態碼一致」）。HTTP 狀態碼照常是 4xx / 5xx
  - 規則：前 3 碼 = HTTP 狀態碼，後 2 碼 = 流水號；`xxx00` 是該狀態的通用錯誤（例如打錯路徑 `40400`、HTTP 方法不對 `40500`）
  - 目前的錯誤碼：

    | code | HTTP | 意思 |
    |---|---|---|
    | `40000` | 400 | 請求錯誤（通用） |
    | `40001` | 400 | 欄位格式不符 |
    | `40100` | 401 | 請先登入 |
    | `40101` | 401 | 帳號或密碼錯誤 |
    | `40300` | 403 | 沒有權限 |
    | `40400` | 404 | 資源不存在 |
    | `40901` | 409 | 帳號已被使用 |
    | `50000` | 500 | 系統繁忙，請稍後再試 |

  - 欄位驗證失敗（`40001`）：`data` 是 `[{ "field": "username", "rule": "pattern" }]`，`rule` 是 Bean Validation 規則名稱的小駝峰（`pattern`、`size`、`notBlank`…）
  - `msg` 是後端的中文說明，**不要直接顯示給使用者**，只當沒有翻譯時的備用文字
  - 【已完成】（前端 2026-10-15）錯誤訊息按 `code` 翻譯（`errors.<code>`，zh-TW / en）；沒有對應翻譯時，用 `code` 的前 3 碼找通用訊息；欄位錯誤用 `field` + `rule` 對應到表單的錯誤 key
    （翻譯在 `messages` 的 `ApiErrors`，查找邏輯在 `lib/api/useApiErrorText.ts`）
- 【已完成】（2026-10-15，見上方帳戶接口）登入、註冊頁的介面已完成（目前送出是模擬），需要後端提供接口：
  - 登入：帳號 + 密碼；註冊：帳號、暱稱、密碼（確認密碼只在前端比對，不送出）
  - 前端暫定的欄位規則（後端驗證請一致，或告訴前端改）：
    - 帳號 `^[A-Za-z0-9_]{4,20}$`
    - 暱稱去掉頭尾空白後 2–16 個字
    - 密碼 8–64 個字元
  - 前端需要能區分的錯誤：帳號或密碼錯誤、帳號已被使用、欄位格式不符（最好帶欄位名稱，前端顯示在對應欄位下）
  - 登入狀態用什麼方式保存（HttpOnly cookie 或 token）由後端決定，前端配合
  - 前端要做什麼：接口出來後，把 `frontend/src/features/auth/api.ts` 的模擬換成真的請求
- 【待後端】開獎動畫方案已確定，設計期數相關 API 時請參考 [draw-animation.md](draw-animation.md) 的「後端需要配合」：
  - `closeAt`、`drawAt` 時間點；`numbers` 保留開出順序（不排序）
  - 期數回應帶 `serverTime`（毫秒精度），用來校正時鐘
  - 「取得目前期數」接口；WebSocket 推送 `CLOSED`、`DRAWN`
  - 前端要做什麼：後端 API 出來後，按契約接上開獎舞台

## 2026-10-14
- 專案建立，尚無業務 API。
- 已有：`GET /actuator/health`（健康檢查）、`GET /v3/api-docs`（OpenAPI 契約）。
