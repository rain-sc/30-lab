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

## 2026-10-21（前端：冷熱號碼）
- 【已完成】回覆後端「冷熱號碼」那筆的【待前端】：
  - 冷熱號碼改用 `GET /api/draws/number-stats?window=100`，前端自己用開獎紀錄算的邏輯已拿掉
  - 熱門用 `count + specialCount` 排序（和原本一樣把特別號碼算進次數）；冷門用 `missed`；同分時號碼小的在前
  - 重抓時機：進頁面、開獎動畫播完時。**動畫播放中打開頁面時先不抓**（後端統計已經包含最新一期，抓了會提前暴露），等動畫播完才抓
  - 統計期數顯示回應的 `window`（「最近 100 期」）；載入失敗顯示重試
  - `/api/draws/number-stats` 加進「已登出也能送」的清單
- 已用真的後端驗證：畫面的熱門 / 冷門前 6 名和 API 依同樣規則排序的結果一致；整個開獎過程中 `number-stats` 只在進頁面和動畫播完（開獎後 25 秒）時各打一次，開獎後新的次數（例如 26 號 19 → 20 次）在動畫播完後才出現

## 2026-10-21（後端：冷熱號碼）
- 【新增】`GET /api/draws/number-stats?window=100`（**不用登入**）：最近 `window` 期已開獎（`DRAWN` / `SETTLED`）的號碼統計
  ```json
  { "window": 100,
    "numbers": [ { "number": 1, "count": 17, "specialCount": 2, "missed": 6 },
                 { "number": 2, "count": 11, "specialCount": 1, "missed": 0 }, ... ] }
  ```
  - `numbers` **固定 49 筆**，依號碼 1~49 排序；熱門 / 冷門的排序和取前幾名由前端決定
  - `count`：開出幾次**正碼**；`specialCount`：開出幾次**特別號碼**（分開給）
  - `missed`：已經**連續幾期沒開出**，正碼或特別號碼都算開出；`0` = 最近一期有開出；整段都沒開過 = `window`
  - `window`：預設 100，範圍 1~500（超出範圍會自動夾住，不報錯）；回應的 `window` 是**實際統計的期數**，已開獎的期數不夠時會比要求的少
  - 非數字（`window=abc`）→ `40001`，`field: "window"`、`rule: "typeMismatch"`
- 已用 8088 的真實資料驗證：100 期的 `count` 加總 600、`specialCount` 加總 100；`missed = 0` 的 7 個號碼就是最新一期的 6 個正碼 + 特別號
- 回覆 10/16「接上真資料需要的接口」第 6 項冷熱號碼（可選）：**已完成**
- 【已完成】（前端 2026-10-21，見上方前端那筆）
  1. 重新 `npm run gen:api`
  2. 冷熱號碼改接這支 API，`hotColdStats.ts` 自己算的邏輯可以拿掉。⚠️ 目前前端的「熱門」把特別號碼也算進次數，要維持一樣的算法就用 `count + specialCount` 排序；`missed` 的定義和現在前端一樣
  3. 什麼時候重新抓：進頁面時、開獎動畫播完時（不要在收到 `DRAWN` 時馬上抓，不然最新一期的號碼會在動畫播完前出現在冷熱號碼裡）
  4. 統計期數可以顯示出來（例如「近 100 期」），用回應的 `window`

## 2026-10-21（前端：結算、派彩、頭獎彩池）
- 【已完成】回覆後端「結算、派彩、頭獎彩池」那筆的 6 項【待前端】：
  1. 已重新 `npm run gen:api`
  2. 我的注單改用 `results` / `payout`：每注顯示獎級和獎金，注單顯示「中獎 +N 積分」或「未中獎」；前端自己對獎的邏輯已拿掉。過了開獎時間還是 `PENDING` 時顯示「結算中」
  3. 開獎通知改用注單的 `results` 和 `payout`：中獎顯示獎級 × 注數和獎金（金額累加 + 火花）
  4. 收到 `SETTLED` → 重新抓注單、錢包、積分紀錄、彩池、開獎紀錄
  5. 頭獎彩池改用 `GET /api/jackpot`（進頁面、`SETTLED`、自己下注成功後、每 30 秒；`drawNo` 和目前這期不同時不顯示）；開獎紀錄每期顯示 `poolAmount` 和有沒有人中頭獎。前端已經沒有任何示例資料
  6. 獎級 `FIRST` ~ `SEVENTH` 的 i18n（繁中 / 英文）
- **不提前暴露中獎結果**：`SETTLED` 到了之後馬上重新抓錢包和注單，但畫面上：
  - 積分 = 錢包餘額 − 還沒播完開獎動畫那幾期的 `payout`，動畫播完的那一刻才滾上去（浮出「+40」）
  - 我的注單、開獎通知都等動畫播完才顯示中獎結果
  - 積分紀錄頁的 `PAYOUT` 那一筆會在 `SETTLED` 後就出現（沒有另外延後；只在使用者剛好開著積分紀錄頁時看得到）
- 已用真的後端驗證（下 50 注、5 分鐘一期）：事件依序 `CLOSED` → `OPENED` + `DRAWN` + `SETTLED`（同一秒）；開獎後 6 秒錢包已是 9,540、注單 `PAID`、`payout` 40，但畫面積分仍是 9,500、我的注單顯示「待開獎」；動畫播完跳出「恭喜中獎！七獎 × 1 +40」、積分滾到 9,540；積分紀錄有 `PAYOUT +40`；開獎紀錄顯示「彩池 1,000,156・無人中頭獎」；下 50 注後 `GET /api/jackpot` 增加 100

## 2026-10-21（後端：結算、派彩、頭獎彩池）
- 開獎（`DRAWN`）後**約 1 秒內**自動結算完成：判獎 → 派彩（加積分、寫 `PAYOUT` 流水）→ 期數變成 `SETTLED`，並推播 `SETTLED`。獎金規則見 [game-rules.md](game-rules.md)
- 【修改】WebSocket `/topic/draws` 新增 `type: "SETTLED"`
  ```json
  { "type": "SETTLED", "serverTime": "...",
    "draw": { "drawNo": "20261021-0408", "status": "SETTLED", "numbers": [23, 36, 18, 41, 2, 28], "specialNumber": 15,
              "poolAmount": 1000100, "jackpotWinners": 0, "openAt": "...", "closeAt": "...", "drawAt": "..." } }
  ```
  - 順序：`CLOSED` →（開獎時間）`DRAWN` + 下一期 `OPENED` →（約 1 秒後）這一期的 `SETTLED`
  - **收到 `SETTLED` 時派彩已經完成**：重新抓我的注單、`GET /api/wallet`、`GET /api/jackpot`
  - 注意：`SETTLED` 會比開獎動畫（7 顆 × 3.6 秒）**早很多**到達。中獎結果和積分增加請等動畫播完再顯示，不要提前暴露
  - 後端重啟時會一次補結算積壓的期數（照時間順序），每期都會推一則 `SETTLED`，請用 `drawNo` 對應
- 【修改】`GET /api/tickets` 的注單多了 3 個欄位（下注回應 `POST /api/tickets` 的 `ticket` 也一樣）
  ```json
  { "id": "...", "drawNo": "20261021-0408", "betType": "SINGLE", "lines": [[2, 9, 18, 30, 36, 44], ...], "cost": 500,
    "status": "PAID", "payout": 40, "settledAt": "2026-10-21T06:48:01.281Z",
    "results": [ { "matched": 3, "specialHit": false, "tier": "SEVENTH", "prize": 40 },
                 { "matched": 1, "specialHit": false, "tier": null, "prize": 0 }, ... ],
    "createdAt": "..." }
  ```
  - `results` 和 `lines` **一一對應**（同樣的順序）；`matched` 中幾個正碼、`specialHit` 有沒有中特別號碼、`prize` 這一注的獎金
  - `tier`：`FIRST` 頭獎、`SECOND` 二獎 … `SEVENTH` 七獎；**沒中獎是 `null`**（中 2 個以下）。獎級名稱請前端做 i18n
  - `payout`：整張注單的總獎金 = 每注 `prize` 加總
  - 結算前（`PENDING`）：`results` 和 `settledAt` 是 `null`，`payout` 是 `0`
  - `status`：`PENDING` 待開獎 → `LOST` 未中獎 / `WON` 已中獎 → `PAID` 已派彩。`WON` 只會維持幾毫秒（派彩完馬上變 `PAID`），畫面上可以和 `PAID` 顯示成一樣
- 【修改】`DrawResponse`（`GET /api/draws`、`GET /api/draws/current`、WebSocket 的 `draw`）多了 2 個欄位，**`SETTLED` 之後才有**（之前不會出現在 JSON 裡，跟 `numbers` 一樣）
  - `poolAmount`：這一期的頭獎彩池
  - `jackpotWinners`：中頭獎的**注數**（`0` = 沒人中，彩池整個滾到下一期）
- 【新增】`GET /api/jackpot`（**不用登入**）：目前這期的頭獎彩池（估計值）
  ```json
  { "drawNo": "20261021-0409", "amount": 1000100 }
  ```
  - `amount` = max(1,000,000, 上期滾存 + 本期目前投注額 × 20%)，**別人下注也會讓它變大**
  - `drawNo` 是這個數字屬於哪一期，跟目前顯示的期數不同就不要用
  - **什麼時候重新抓**：進頁面時、收到 `SETTLED` 時、自己下注成功後；想讓別人下注的增加也看得到，可以加定時輪詢（例如 30 秒）
  - **不要在收到 `OPENED` 時抓**：新的一期剛開時，上一期還要約 1 秒才結算完，這時抓到的滾存是舊的；等上一期的 `SETTLED` 再抓才正確
- 積分流水（`GET /api/wallet/transactions`）開始會出現 `PAYOUT`（`amount` 為正，`refId` = 注單 id）
- 沒有新的錯誤碼
- 已用真的後端驗證（1 分鐘一期的副本）：下 50 注 → 事件依序 `CLOSED > DRAWN > SETTLED`；`SETTLED` 的 `poolAmount` = 1,000,000 + 500 × 20% = 1,000,100；注單變成 `PAID`、`payout = 40`（一注七獎）；積分流水有 `BET −500`、`PAYOUT +40`；下一期 `GET /api/jackpot` = 1,000,100
- 回覆前端 10/21 的【待後端】（注單結果欄位、派彩推播方式）：**已完成**，見上面
- 【已完成】（前端 2026-10-21，見上方前端那筆）
  1. 重新 `npm run gen:api`
  2. 我的注單：顯示每注的獎級、獎金，以及注單的總獎金；拿掉「已開獎・等待結算」和前端自己對獎的邏輯，改用 `results`（`PENDING` 但已過開獎時間時，仍可以顯示「結算中」）
  3. 開獎通知改用後端的中獎結果：動畫播完後，用這一期的注單 `payout` 顯示中了多少；積分用 `GET /api/wallet` 的數字更新（數字滾動照舊）
  4. 收到 `SETTLED` 時重新抓我的注單、錢包、彩池
  5. 首頁 / 大廳的頭獎彩池改接 `GET /api/jackpot`；開獎紀錄可以顯示每期的 `poolAmount`、有沒有人中頭獎
  6. 獎級名稱 `FIRST` ~ `SEVENTH` 的 i18n（zh-TW / en）

## 2026-10-21（前端：下注、我的注單、積分紀錄）
- 【已完成】回覆後端「下注、我的注單」那筆的【待前端】：
  - 「確認下注」改用 `POST /api/tickets`（待下注的每一注 = `lines`，一次送出一張注單）；成功後用回應的 `balance` 更新積分，重新抓我的注單、積分紀錄
  - `idempotencyKey`：每次確認下注產生新的 UUID；失敗原因不確定（網路斷了、逾時、5xx）而且待下注沒變時，重試沿用同一個，同時重新抓積分和注單
  - `40903` 已截止 → 提示並重新抓 `GET /api/draws/current`；`40902` 積分不足 → 重新抓錢包；`40002`、`40903` 翻譯已加
  - 送出前前端先檢查：每張最多 50 注（待下注滿 50 注時「加入待下注」停用）、已截止、餘額不足；每注號碼由選號盤保證不重複
  - 示例注單和積分的示例增減**已全部拿掉**，積分完全是 `GET /api/wallet` 的數字
  - 「我的注單」改用 `GET /api/tickets`（分頁）；「積分紀錄」頁接 `/api/wallet/transactions`（和我的注單在同一頁，用分頁籤切換）
- **結算模組完成前**：開獎動畫播完後，我的注單和開獎通知用開獎號碼**在前端**標出每注中了哪幾個、可能的獎級，狀態顯示「已開獎・等待結算」，**不顯示獎金**
  - 注單沒有 `drawAt`，前端用期數號的規則（UTC、第 N 個 5 分鐘）算出開獎時間，決定什麼時候能對獎
- 已用真的後端驗證：
  - 下 2 注 → 積分 10,000 → 9,980；本期已下注、我的注單、積分紀錄（註冊贈送 +10,000、下注 −20）正確
  - 讓請求送到後端、但瀏覽器收不到回應 → 畫面顯示連線錯誤、積分馬上更新成 9,980；重試帶同一個 key → 只有一張注單、只扣一次
  - 期數改成舊的 → `40903`「這一期已截止下注」；之後正常送出改用新的 key
  - 開獎（`0030`）後跳出通知、我的注單顯示開獎號碼和每注中幾個
- 【已完成】（後端 2026-10-21，見上方「結算、派彩、頭獎彩池」）結算模組完成時，請在 changelog 說明注單會多哪些欄位（每注中幾個、獎級、獎金）和派彩的推播方式（前端要在派彩後更新積分、把通知改成後端的中獎結果）

## 2026-10-21（後端：下注、我的注單）
- 【新增】`POST /api/tickets`（**要登入**）：下注
  ```json
  // request
  { "drawNo": "20261021-0026", "idempotencyKey": "3f1c2a9e-...", "lines": [[45, 3, 27, 11, 34, 18], [1, 2, 3, 4, 5, 6]] }
  // response data
  { "ticket": { "id": "...", "drawNo": "20261021-0026", "betType": "SINGLE",
                "lines": [[3, 11, 18, 27, 34, 45], [1, 2, 3, 4, 5, 6]], "cost": 20, "status": "PENDING", "createdAt": "..." },
    "balance": 9980 }
  ```
  - **一次送出 = 一張注單**，`lines` 是這次送出的每一注；`cost` = 注數 × 10；每注的號碼會排序成由小到大
  - 回應帶 `balance`（下注後的餘額），可以直接更新畫面，不用再打 `GET /api/wallet`
  - `drawNo` 必須是目前這期（`GET /api/draws/current` 的 `current.drawNo`），而且要在 `closeAt` 之前
  - **`idempotencyKey`**：每次按「確認下注」產生一個新的（`crypto.randomUUID()`）；**網路失敗重試時沿用同一個**。同一個 key 再送，回傳第一次建立的那張注單，**不會重複扣款**（同時送出多次也一樣）
  - 同一張注單可以有重複的號碼組合；每張最多 50 注
- 【新增】`GET /api/tickets?page=1&size=20`（**要登入**）：我的注單，由新到舊，分頁格式同其他列表（`PageResult`）
  - `status` 目前都是 `PENDING`（待開獎）；之後結算完會變成 `LOST` / `WON` / `PAID`，並加上每注中幾個、獎級、獎金（**等結算模組**）
- 錯誤碼
  | code | HTTP | 意思 |
  |---|---|---|
  | `40001` | 400 | 欄位格式不符（`data` 是欄位錯誤清單，見下方） |
  | `40002` | 400 | **注數超過上限**（每張 50 注）（新增） |
  | `40902` | 409 | 積分不足 |
  | `40903` | 409 | **這一期已截止下注**：`drawNo` 不是目前這期，或已過 `closeAt`（新增） |
- 欄位錯誤（`40001`）可能出現的 `field` + `rule`：
  - `drawNo` / `idempotencyKey` → `notBlank`；`idempotencyKey` → `size`（最長 64）
  - `lines` → `notEmpty`（沒有任何一注）
  - `lines[0]` → `size`（第 1 注不是 6 個號碼）；`lines[0]` → `notNull`
  - `lines[0][5]` → `min` / `max`（第 1 注第 6 個號碼不在 1~49）
  - `numbersDistinct` → `assertTrue`（某一注有重複的號碼；沒有指出是哪一注，前端送出前可以先自己檢查）
- 下注、派彩會寫積分流水：`BET`（`amount` 為負，`refId` = 注單 id）
- 回覆 10/16 清單第 3 項「下注」、第 5 項「我的注單」：**已完成**（中獎結果等結算模組）
- 【已完成】（前端 2026-10-21，見上方前端那筆）
  - 大廳「確認下注」改接 `POST /api/tickets`，拿掉示例注單和積分的示例增減；送出成功用回應的 `balance` 更新積分
  - 加 `errors.40002`、`errors.40903` 翻譯；`40903` 時提示「這期已截止」並重新抓 `GET /api/draws/current`
  - 「我的注單」改接 `GET /api/tickets`；「積分紀錄」頁可以開始做（`/api/wallet/transactions`，`BET` 的 `refId` 對到注單 id）

## 2026-10-20（前端：錢包）
- 【已完成】回覆後端「錢包」那筆的【待前端】：
  - 頁首的積分改用 `GET /api/wallet`（TanStack Query，queryKey 帶帳號）；載入失敗時變成「重試」按鈕
  - **下注 API 完成前**：積分 = 錢包餘額 + 前端示例注單的增減（− 每注 10 + 示例獎金），下注、派彩的數字滾動照常運作；下注 API 好了之後拿掉示例增減
  - 錯誤碼 `40902` 積分不足的翻譯已加（`ApiErrors`，繁中 / 英文）
  - 「積分紀錄」頁（`/api/wallet/transactions`）**等下注 API 完成後再做**，到時和「我的注單」一起設計
- 已用真的後端驗證：新帳號顯示 10,000；下兩注示例注單變 9,980、重新整理後不變；錢包上線前註冊的帳號（`rain_01`）自動補開戶為 10,000；錢包 API 失敗時顯示重試、按下後恢復
- 【待後端】下注 API 完成時，請在 changelog 說明下注成功的回應有沒有新的餘額（有的話前端直接用，沒有的話前端下注後重新抓 `GET /api/wallet`）

## 2026-10-20（後端：錢包）
- 【新增】`GET /api/wallet`（**要登入**）：我的積分餘額 `{ "balance": 10000 }`
- 【新增】`GET /api/wallet/transactions?page=1&size=20`（**要登入**）：我的積分流水，由新到舊，分頁格式同開獎紀錄（`PageResult`，`size` 最大 100）
  ```json
  { "list": [ { "type": "SIGNUP_BONUS", "amount": 10000, "balanceAfter": 10000, "refId": "...", "createdAt": "..." } ],
    "total": 1, "page": 1, "size": 20 }
  ```
  - `type`：`SIGNUP_BONUS` 註冊贈送、`BET` 下注、`PAYOUT` 派彩（下注、派彩要等下注模組，目前只會看到註冊贈送）
  - `amount` 收入為正、支出為負；`balanceAfter` 是這筆之後的餘額
  - `refId`：註冊贈送是使用者 id；下注 / 派彩之後會是注單 id，可以用來連到注單
- **註冊送 10,000 積分**，註冊時自動開戶。錢包功能上線前註冊的帳號，第一次打 `/api/wallet` 或 `/api/wallet/transactions` 時自動補開戶，一樣送 10,000
- 【新增】錯誤碼 `40902` **積分不足**（下注時會用到，請先加翻譯）
- 回覆 10/16 清單第 4 項「積分餘額」：**已完成**，用獨立的 `GET /api/wallet`，沒有放進 `/me`
  - 之後下注、派彩後餘額會變動，前端在這些操作完成後重新抓 `GET /api/wallet` 即可
- 【已完成】（前端 2026-10-20，見上方前端那筆）大廳顯示的積分改接 `GET /api/wallet`；加 `40902` 翻譯；「積分紀錄」頁等下注 API 完成後再做

## 2026-10-20（前端：開獎紀錄）
- 【已完成】回覆後端「開獎紀錄」那筆的【待前端】：
  - 大廳的近期開獎、開獎紀錄頁（每頁 20 筆、上一頁 / 下一頁）、冷熱號碼（`size=100`，期數不到 100 時顯示實際期數）改用 `GET /api/draws`，示例資料已拿掉
  - 最新一期等開獎動畫播完（開獎後 25 秒）才列出，不會比舞台先劇透
  - 示例注單「待確認」的期數：用 `GET /api/draws` 往回查（每頁 100 筆，最多 10 頁），查到就對獎；開獎紀錄裡沒有的期數顯示「查不到這期的開獎結果」
  - `/api/draws` 已加進「已登出也能送」的清單
  - 前端開始用 TanStack Query 管理後端資料（開獎紀錄、補查）
- 已用真的後端驗證：
  - 近期開獎第一筆、開獎紀錄第 2 頁第一筆和 API 一致；分頁 3 頁（41 期）
  - 補查：舊期數 `0055` 查到號碼並正確對獎；不存在的期數顯示「查不到」
  - 完整開獎一次（`0087`）：依序收到 `CLOSED` → `OPENED 0088` + `DRAWN 0087`（同一秒）；舞台開球、動畫播完跳出開獎通知、示例注單用真實號碼對獎、近期開獎更新

## 2026-10-20（後端：開獎紀錄）
- 【新增】`GET /api/draws?page=1&size=20`（**不用登入**）：開獎紀錄，由新到舊
  ```json
  { "list": [ { "drawNo": "20261020-0081", "status": "DRAWN", "openAt": "...", "closeAt": "...", "drawAt": "...",
                "numbers": [...], "specialNumber": 22 } ],
    "total": 34, "page": 1, "size": 20 }
  ```
  - 只有已開獎（`DRAWN` / `SETTLED`）的期數；`list` 每一筆的型別是 `DrawResponse`，和 `GET /api/draws/current` 一樣
  - 分頁格式是共用的 `PageResult`（`openapi.json` 的 `PageResultDrawResponse`），之後「我的注單」也會用同一個格式
  - `page` 從 1 開始，預設 1；`size` 預設 20，**最大 100**。超出範圍不會報錯，會自動修正（`page=0` → 1、`size=500` → 100）
  - 期數號**可能不連續**：後端停機期間的期數不會被建立（那段時間不能下注），例如 `0077` 之後直接是 `0079`
- 【修改】查詢參數型別錯誤（例如 `?page=abc`）原本會回 `500`，改成 `400` + `40001`，`data` 是 `[{ "field": "page", "rule": "typeMismatch" }]`，和欄位驗證失敗同一個格式
- 【已完成】（前端 2026-10-20，見上方前端那筆）
  - 大廳的「開獎紀錄」改接這個接口，示例資料可以拿掉；冷熱號碼可以用 `size=100` 的資料計算
  - 示例注單裡「待確認」的期數（前端不在線上時開獎的），可以用這個接口補查號碼
  - `/api/draws` 和 `/api/draws/current` 一樣不用登入，可以加進「已登出也能送」的清單

## 2026-10-20（前端：接上目前期數 API 和開獎推播）
- 【已完成】倒數、期數號、截止狀態、3D 舞台的開獎時間和號碼、登入頁的「上期開獎結果」改用 `GET /api/draws/current` + `/topic/draws`
  - 時鐘：用 `serverTime` 算出和本機的差距，倒數和開獎動畫都用校正後的時間
  - 收到的期數**依 `drawNo` 存起來**：「目前這期」= 開獎時間最晚的那期，「上一期」= 有號碼的期數裡最晚的那期，補送的過期事件不會被當成目前這期
  - 推播晚到：截止後、或新的一期開始了還沒收到上一期號碼，舞台繼續攪珠等（最多等 60 秒）
  - WebSocket 重連、分頁切回來、過了開獎時間 5 秒還沒收到推播 → 重新 `GET /api/draws/current`；抓不到時大廳顯示「正在自動重試」，每 10 秒重試
  - 期數號直接用後端的；時間一律從 `openAt` / `closeAt` / `drawAt` 轉成當地時間
  - `/draws/current` 加進前端「這個分頁已登出也能送」的清單（不用登入的接口，登入頁的直播面板要用）
- 還是示例的部分：頭獎彩池、開獎紀錄（收到過的真實結果優先，更早的期數用示例補齊並標「示例」）、冷熱號碼、下注 / 積分 / 我的注單
  - 示例注單用**真實開獎號碼**對獎；開獎時前端不在線上（沒收到號碼）的期數顯示「待確認」，等開獎紀錄 API 完成後補上
- 已用真的後端驗證：期數號、倒數秒數和 API 一致；上一期號碼正確；截止後停止下注、舞台開始攪珠；後端停掉時大廳顯示重試提示
  - 收到 `DRAWN` 之後的開球、中獎通知、對獎：已補測通過（見上方 2026-10-20 前端：開獎紀錄）

## 2026-10-20（後端：開獎）
- 【新增】`GET /api/draws/current`（**不用登入**）：目前期數 + 最近一期開獎結果
  ```json
  { "serverTime": "2026-10-20T05:43:09.228Z",
    "current":  { "drawNo": "20261020-0069", "status": "OPEN", "openAt": "...", "closeAt": "...", "drawAt": "..." },
    "previous": { "drawNo": "20261020-0068", "status": "DRAWN", "openAt": "...", "closeAt": "...", "drawAt": "...",
                  "numbers": [17, 49, 15, 21, 2, 20], "specialNumber": 35 } }
  ```
  - `current` 一定有；`previous` 在系統剛上線、還沒開過獎時**沒有這個欄位**
  - `numbers` / `specialNumber` **開獎後才有**，開獎前**欄位不存在**（不是 `null`），對應生成型別的 `numbers?: number[]`
  - `numbers` 是 6 個正碼，**依開出順序，沒有排序**
  - `status`：`OPEN` 下注中 → `CLOSED` 停止下注 → `DRAWN` 已開獎 →（之後做完結算）`SETTLED`
- 【新增】WebSocket 廣播 `/topic/draws`（**不用登入**，匿名連線也收得到）
  ```json
  { "type": "DRAWN", "serverTime": "...", "draw": { 和上面的 current / previous 同一個格式 } }
  ```
  - `type`：`OPENED`（新的一期開放）、`CLOSED`（停止下注）、`DRAWN`（開獎，`draw` 裡有號碼）
  - `draw` 的型別就是 `openapi.json` 的 `DrawResponse`，可以直接用生成的型別
  - 每到開獎時間會**同一秒**收到兩則：下一期的 `OPENED` 和這一期的 `DRAWN`
  - 推送最多晚 1 秒（後端每秒對帳一次）；動畫進度請照舊用 `drawAt` + `serverTime` 計算
  - 後端當機重啟時，會一次補送過期的 `CLOSED` / `DRAWN`（`drawAt` 可能是幾分鐘前），請**用 `drawNo` 對應**，不要假設收到的一定是目前這期
  - 已用 Node 匿名連線驗證：`CLOSED` 延遲 0.96 秒、`OPENED` / `DRAWN` 延遲 0.16 秒，時間欄位都是字串
- **期數號 `drawNo`**：`yyyyMMdd-NNNN`，**以 UTC 計算**（`NNNN` = UTC 當天第幾個 5 分鐘，`0001`~`0288`），全世界一致。前端顯示時間請用 `openAt` / `closeAt` / `drawAt` 轉成當地時間，**不要從期數號推算日期**
- **時間字串的格式**：毫秒剛好是 0 時會省略，例如 `drawAt` 是 `2026-10-20T05:45:00Z`、`serverTime` 是 `2026-10-20T05:43:09.228Z`。兩種都是標準 ISO 8601，`new Date()` 都能解析，**只是不要直接比較字串**
- 回覆下方 10/16 的「接上真資料需要的接口」：
  1. 目前期數：**已完成**（上面），**頭獎彩池還沒有**，要等結算模組（彩池的計算規則在 `game-rules.md` 還是待定）
  2. 開獎紀錄（分頁）：**已完成**，見上方「開獎紀錄」
  3. 下注、5. 我的注單：**已完成**，見上方「下注、我的注單」（中獎結果等結算模組）；4. 積分餘額：**已完成**，見上方「錢包」
  6. 冷熱號碼：先用開獎紀錄在前端計算
- 【已完成】（前端 2026-10-20）把大廳的「目前期數」、開獎舞台改接 `GET /api/draws/current` 和 `/topic/draws`，已重新 `npm run gen:api`

## 2026-10-16（前端：大廳完成，期數 / 下注 / 積分目前是前端示例資料）
- 前端大廳（選號盤、待下注、確認下注、我的注單、開獎紀錄、冷熱號碼）已完成，目前用前端模擬的資料，畫面標示「示例數據」
- 【待後端】接上真資料需要的接口（路徑、欄位命名由後端決定，以下是前端用到的資料）：
  1. **目前期數**：期數號、`closeAt`、`drawAt`、狀態、頭獎彩池、`serverTime`；`DRAWN` 後含 `numbers`（保留開出順序）、`specialNumber`（見 `docs/draw-animation.md`「後端需要配合」）
  2. **開獎紀錄**（分頁）：期數號、`drawAt`、`numbers`、`specialNumber`
  3. **下注**：一次送出多注（每注 6 個號碼），下到目前這一期；截止後拒絕、積分不足拒絕（各自一個錯誤碼，前端會翻譯）
  4. **積分餘額**：可以放在 `GET /me` 的回應裡，或另一個接口
  5. **我的注單**（分頁）：期數號、號碼、狀態（待開獎 / 已結算）、中幾個、獎級、獎金
  6. （可選）**冷熱號碼**：最近 N 期每個號碼的開出次數、遺漏期數；沒有的話前端用開獎紀錄自己算
- 前端目前的期數號格式是暫定的 `YYYYMMDD-NNNN`（當天第幾期），以後端定的為準

## 2026-10-16（前端）
- 【待後端，可選】用區網 IP 開前端（例如手機測試 `http://192.168.0.171:3100`）時，WebSocket 握手被拒絕（`403`），因為 `app.cors.allowed-origins` 只有 `http://localhost:3100`
  - 前端已改成用**頁面的主機名稱**連 WebSocket（`ws://192.168.0.171:8088/ws`），cookie 的主機名稱才對得上，手機也能連
  - 目前不用改程式：啟動後端時設 `CORS_ALLOWED_ORIGINS=http://localhost:3100,http://192.168.0.171:3100` 就可以（`.env.example` 已補上說明）
  - 如果想不用每次換 IP 都改設定，可以把 `WebSocketConfig` 的 `setAllowedOrigins` 改成 `setAllowedOriginPatterns`，設定值支援 `http://192.168.*.*:3100` 這種寫法

## 2026-10-16（回退：同一瀏覽器多分頁的特殊處理太複雜，停用）
- **決定**：下面「同一瀏覽器同帳號，舊分頁要登出」那整節（含「在此分頁繼續」「停用 / 接管」）**回退**，不要再分「別台裝置」和「同一瀏覽器的另一個分頁」
- **統一規則**：不管從哪裡觸發（API 還是 WebSocket、同裝置還是不同裝置、同瀏覽器不同分頁還是不同瀏覽器），**同一帳號重新登入一律踢掉前一個 session**，被踢的一方收到通知或下一次打 API 時，直接當成登出處理，不用先判斷「是不是自己」
- 【已完成】後端：移除跨帳號的 `CurrentSession` / `endOtherAccount`（上面提到的「分頁 2 登入 B，順便登出 A」），`AuthController` / `AuthService` / `SessionService` 都退回只有「同帳號登入踢前一個」這一條規則。WebSocket 端點、broker、`SESSION_REPLACED` 推播都不變
- 【待前端】請同步簡化 `SessionWatcher` / `api.ts`：
  - 收到 `SESSION_REPLACED`（WebSocket），或任何 API 回應 `401`（`40100` / `40102`）→ 一律當作被登出：斷開 WebSocket、導向登入頁，**不用再判斷使用者是不是同一個**
  - 可以整個移除：`park` / `takeOver`、「在此分頁繼續」按鈕、`BroadcastChannel` 對「同一個 userId → 靜默重連」的特殊處理
  - ⚠️ **仍然要注意**：被通知的分頁**不要呼叫 `POST /api/auth/logout`**——這個瀏覽器的 cookie 可能已經是新登入那邊的 session，呼叫登出會把新的那邊也登出；被通知的分頁只需要在畫面上表現成登出、導向登入頁即可
  - 要不要保留「正在登入的分頁忽略自己觸發的通知」這類防呆，前端自行判斷，不是必要條件

## 2026-10-15（後端 → 前端：同一瀏覽器同帳號，舊分頁要登出）⚠️ 已回退，見上方 2026-10-16
- 【已完成】（前端 2026-10-15）照下方規格實作，**含可選的「在此分頁繼續」**；用真的後端驗證通過：
  - 分頁 2 登入同帳號 → 分頁 1 導向 `/login?reason=other-tab`，**不開 WebSocket**（實測停用後 0 條連線），分頁 2 的 `/me` 仍是 `200`（沒有被登出）
  - 分頁 1 按「在此分頁繼續」→ 分頁 1 回到首頁、重新連線；分頁 2 進入停用（對稱）
  - 停用中的分頁重新輸入密碼登入 → 另一個分頁停用（對稱）
  - 別台裝置登入 → 使用中的分頁導向 `/login?reason=replaced`；停用中的分頁按「繼續」時 cookie 已失效，改導向 `replaced`
  - 實作：`SessionWatcher`（判斷）、`api.ts` 的 `park` / `takeOver`（停用、接管）、`SessionNotice`（提示 + 按鈕）
- **同一個瀏覽器：分頁 1 已登入 A，分頁 2 也登入 A → 分頁 1 要自動登出**（產品決定：同一個帳號同時只能在一個分頁使用，避免兩個分頁同時下注造成混亂）
  - **後端不用改**：分頁 2 登入時，後端已經會推 `SESSION_REPLACED` 給分頁 1 的 WebSocket
  - **目前的行為（要改掉）**：
    - `SessionWatcher.handleReplaced`：`/me` 回 200 且是同一個使用者 → `restartWs()`，分頁 1 繼續使用
    - `BroadcastChannel` 收到 `auth-changed` 且 `userId` 相同 → `restartWs()`，分頁 1 繼續使用
  - **改成**：上面兩種情況（同一個使用者、通知來自別的分頁），分頁 1 都進入「已在其他分頁登入」狀態
    - 斷開 WebSocket，**不要重新連線**
    - 畫面顯示提示（例如「此帳號已在其他分頁登入」）和「返回登入」；最簡單是整頁導向 `/login?reason=other-tab`
    - **這個狀態下不能再送出需要登入的請求**：cookie 是共用的，分頁 1 送出的請求帶的是分頁 2 的新 session，後端會照常處理（等於分頁 1 還能下注）。整頁導向登入頁是最保險的做法
  - ⚠️ **不要呼叫 `POST /api/auth/logout`**：分頁 1 的 cookie 已經是分頁 2 的 session，呼叫會把**分頁 2 也登出**。分頁 1 只在畫面上登出
  - ⚠️ 登入頁要確認：cookie 仍然有效時，登入頁**不能自動跳回首頁**，否則 `/login?reason=other-tab` 會馬上被導回去
  - 不變的部分：
    - 這個分頁自己正在登入時收到的通知照樣忽略（`isSigningIn`）
    - `/me` 回 401（真的被別台裝置取代）→ 照原本流程 `/login?reason=replaced`
    - 另一個分頁換成**別的帳號**登入 → 照目前的做法（重新整理）
  - 分頁 1 在登入頁重新登入 A → 後端取代分頁 2 的 session、推播給分頁 2 → 分頁 2 進入同樣的狀態，規則是對稱的
  - （可選）**「在此分頁繼續」**：提示畫面多一個按鈕，按下後用 `BroadcastChannel` 廣播「接管」，其他同帳號的分頁進入「已在其他分頁登入」狀態，這個分頁重新連 WebSocket 並重新載入資料。cookie 本來就有效，**不用打任何後端 API、不用重新輸入密碼**。要不要做由前端決定

## 2026-10-15（後端，WebSocket）
- 【新增】WebSocket `ws://localhost:8088/ws`，照下方前端的規格實作，規格沒有變動
  - STOMP over 原生 WebSocket（沒有 SockJS）；只允許 `app.cors.allowed-origins` 的來源（目前 `http://localhost:3100`），其他來源握手會被拒絕
  - 有效的 `msl_token` cookie → 連線身分是 session id；沒有 cookie、無效或已被取代 → 匿名連線（可以連，只是收不到 `/user/...`）
  - Broker：`/topic`、`/queue`；user 前綴 `/user`；應用前綴 `/app`；伺服器心跳 10 秒（CONNECTED frame 回 `heart-beat: 10000,10000`）
  - 登入或註冊時，如果同一帳號原本有 session，推 `{ "type": "SESSION_REPLACED" }` 到舊 session 的 `/user/queue/session`；新的 session 不會收到
  - 後端已用 Node（`@stomp/stompjs`）驗證：舊連線收到、新連線和匿名連線收不到、連續登入時每個被取代的連線只收到一次、不允許的來源連不上
  - 【已完成】（前端 2026-10-15）用真的後端驗證 `SessionWatcher` 的三種情境（同瀏覽器同帳號、同瀏覽器換帳號、別台裝置），另外加驗「一個分頁登入 / 登出，其他分頁跟著變」，全部通過
    - 真的後端驗證時發現兩件事，前端已處理，**後端不用改**：
      1. 推播比登入回應的 `Set-Cookie` 早到：其他分頁收到 `SESSION_REPLACED` 馬上打 `/me`，帶的還是舊 cookie，會誤判成被踢。
         前端改成：正在登入的分頁忽略通知；`/me` 回 `401` 時等 1.5 秒再確認一次，兩次都 `401` 才導向登入頁
      2. 同一個瀏覽器的分頁**換成別的帳號**登入或登出時，後端不會推播（原帳號的 session 沒有被取代），其他分頁不會知道。
         這是瀏覽器內部的事，前端用 `BroadcastChannel` 讓分頁之間互相通知：使用者換了就整頁重新整理，同一個使用者就重新連線

## 2026-10-15（後端）
- 回覆下方「WebSocket：被別處登入時即時通知」：方案確認可行，後端照這個規格實作（principal 用 session id、匿名可連、`/user/queue/session` 推 `SESSION_REPLACED`）。**已完成，見上方**
- 【已完成】（前端 2026-10-15，`features/auth/SessionWatcher.tsx`）**同一個瀏覽器開多個分頁時，`SESSION_REPLACED` 會誤判**
  - 前端照建議實作：收到通知先打 `GET /api/auth/me`，`200` 靜默重連、`401` 才導向登入頁
  - 另外處理：`200` 但回來的使用者和這個分頁顯示的不同（另一個分頁換了**別的帳號**登入）→ 整頁重新整理，避免畫面顯示舊帳號的資料
  - 已用模擬的 STOMP 伺服器驗證三種情境（同瀏覽器同帳號、同瀏覽器換帳號、別台裝置）；後端 `/ws` 完成後再用真的後端驗證一次
  - 情境：分頁 1 已登入（session A，WebSocket 身分是 A）；分頁 2 在同一個瀏覽器又登入一次 → cookie 換成 session B → 後端推 `SESSION_REPLACED` 給 A → 分頁 1 被導向 `/login?reason=replaced`，但其實是使用者自己，而且 cookie 仍然有效
  - 原因：cookie 是同一個瀏覽器所有分頁共用的，後端無法分辨「別台裝置」和「同一個瀏覽器的另一個分頁」
  - 建議：收到 `SESSION_REPLACED` 時先打 `GET /api/auth/me`
    - `200`：同一個瀏覽器已經換成新的 session → 靜默重連 WebSocket（讓後端用新 cookie 重新識別），不跳轉
    - `401` + `40102`：確實是別處登入 → 照原本的流程導向 `/login?reason=replaced`

## 2026-10-15（前端）
- 【已完成】（後端 2026-10-15，見上方）**WebSocket：被別處登入時即時通知舊的 session**（目前舊的 session 要等下一次請求收到 `40102` 才知道，停在畫面上的人看不到）
  - 連線：STOMP over 原生 WebSocket（不用 SockJS），端點 `ws://localhost:8088/ws`；允許來源用 `app.cors.allowed-origins`；Security 放行 `/ws`
  - 握手時驗證身分：讀 cookie `msl_token`（瀏覽器會自動帶，`localhost:3100` 和 `:8088` 同 site，`SameSite=Lax` 不擋），驗證方式和 `JwtCookieFilter` 一樣（簽名 + Redis 目前的 session）
    - 驗證通過：STOMP 連線的 `Principal` 名稱 = **session id（JWT 的 `jti`）**，不是 userId。同一個帳號的新舊連線都是同一個 userId，用 userId 推播會連新登入的那邊也收到
    - 沒有 cookie 或無效：**照樣允許連線**（匿名）。之後開獎倒數、開獎結果是公開推播，未登入也要能收
  - Broker：simple broker `/topic`、`/queue`；user 前綴 `/user`；應用前綴 `/app`；心跳 10 秒
  - 推播時機：`AuthService` 登入成功、建立新 session **之前**先讀出舊的 session id（`sessionService.current(userId)`），建立新 session 後，若舊的存在且不同：
    `messagingTemplate.convertAndSendToUser(舊 sessionId, "/queue/session", { "type": "SESSION_REPLACED" })`
  - 訊息格式：`{ "type": "SESSION_REPLACED" }`（之後如果有其他帳號事件，例如被停權，再加 `type`）
  - 前端已完成：全站共用一條 STOMP 連線，訂閱 `/user/queue/session`，收到 `SESSION_REPLACED` 就整頁導向 `/login?reason=replaced`；登入、註冊、登出後會斷線重連，讓後端用新的 cookie 重新識別身分
  - 上線注意：前後端在不同網域時，要確定是同一個 site（例如 `example.com` 和 `api.example.com`），否則 `SameSite=Lax` 的 cookie 不會跟著 WebSocket 握手送出
- 【已完成】（後端 2026-10-15，已重新匯出 `openapi.json`；`Result` 的 `data` 也標成必填，`ResultVoid` 的 `data` 會是 `unknown`）`openapi.json` 裡的回應欄位全部是**可選的**（例如 `UserResponse` 生成出來是 `id?: string`、`username?: string`），前端每次使用都要處理 `undefined`
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
- 【已完成】（後端 2026-10-20，見最上方「開獎」）開獎動畫方案已確定，設計期數相關 API 時請參考 [draw-animation.md](draw-animation.md) 的「後端需要配合」：
  - `closeAt`、`drawAt` 時間點；`numbers` 保留開出順序（不排序）
  - 期數回應帶 `serverTime`（毫秒精度），用來校正時鐘
  - 「取得目前期數」接口；WebSocket 推送 `CLOSED`、`DRAWN`
  - 前端要做什麼：後端 API 出來後，按契約接上開獎舞台

## 2026-10-14
- 專案建立，尚無業務 API。
- 已有：`GET /actuator/health`（健康檢查）、`GET /v3/api-docs`（OpenAPI 契約）。
