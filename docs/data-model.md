# 資料模型（草稿）

MongoDB，資料庫名 `marksixlab`。**草稿**：階段 0 逐個集合討論定稿後，再開始寫代碼。

## 通用約定

- 時間用 `Instant`（UTC），審計字段 `createdAt` / `updatedAt` 由 `@CreatedDate` / `@LastModifiedDate` 自動填。
- 積分用 `long` 整數。
- 「只能發生一次」的事情一律加**唯一索引**，不只靠程式先查再寫。
- 會被並發修改的數值優先用**條件原子更新**（例如 `$inc` 加條件），不需要重試；只有「讀出來、在程式裡改很多欄位、再整份存回」的文件才用 `@Version` 樂觀鎖。

## 集合一覽

| 集合 | 用途 | 主要字段（暫定） | 唯一索引 |
|---|---|---|---|
| `users` | 帳戶 | `username`、`passwordHash`、`nickname`、`roles`、`enabled` | `username` |
| `wallets` | 積分餘額（每人一個） | `userId`、`balance` | `userId` |
| `wallet_transactions` | 積分流水 | `userId`、`type`、`amount`、`balanceAfter`、`refId` | `type + refId` |
| `draws` | 期數 | `drawNo`、`status`、`openAt`、`closeAt`、`drawAt`、`numbers`、`specialNumber`、`drawnAt`、`poolAmount` | `drawNo` |
| `tickets` | 注單 | `userId`、`drawNo`、`betType`、`lines`、`cost`、`status`、`idempotencyKey`（結算後加每注的中獎結果、`payout`） | `userId + idempotencyKey` |

## 設計重點

- **注單預留複式、膽拖**：`betType`（`SINGLE` / `MULTIPLE` / `BANKER`）+ 玩家原始選號 `selections`，再展開成一注一注的 `lines`。
  - 目前只有單式：一張注單的 `lines` 就是玩家送出的每一注（每注 6 個號碼，存成由小到大），`cost = 注數 × 10`
  - `selections` 等做複式、膽拖時再加（單式時跟 `lines` 一樣，先不重複存）
- **下注流程**：檢查期數（目前這期、`OPEN`、還沒過 `closeAt`）→ 在同一個事務裡**建立注單 + 扣積分 + 寫流水**（流水 `refId` = 注單 id）
  - `idempotencyKey`：前端每次確認下注產生一個 UUID；同一個 key 再送一次，直接回傳第一次建立的注單，不會重複扣款
- **注單索引**：`userId + idempotencyKey`（唯一）、`userId + createdAt`（我的注單列表）、`drawNo + status`（結算時找這期待結算的注單）
- **扣積分防並發**：`updateOne({ userId, balance: { $gte: cost } }, { $inc: { balance: -cost } })`，餘額檢查和扣減是同一個原子操作。
- **積分流水**：每一筆餘額變動都寫一筆，`amount` 收入為正、支出為負，`balanceAfter` 是變動後的餘額。
  - `type`：`SIGNUP_BONUS`（註冊贈送，`refId` = userId）、`BET`（下注，`refId` = 注單 id）、`PAYOUT`（派彩，`refId` = 注單 id）。之後有退款、簽到再加
  - `type + refId` 唯一索引保證**同一件事只記一次**：註冊贈送重跑不會送兩次、同一張注單不會扣兩次也不會派彩兩次
- **開戶**：註冊時建立錢包並贈送積分；舊帳號（錢包功能上線前註冊的）第一次查詢錢包時補開戶，同樣靠唯一索引避免重複
- **下注是一個事務**：扣餘額 + 寫流水 + 建立注單，三件事要麼都成功、要麼都失敗（需要副本集）。
- **登入 session 不存 MongoDB**：Redis `session:{userId}` 存目前有效的 session id（TTL = JWT 有效期），JWT 帶同一個 id；不一致代表被新登入踢掉。登出就刪 key。
- **期數號 `drawNo`**：`yyyyMMdd-NNNN`，**以 UTC 計算**，由開放時間 `openAt` 推出：日期是 `openAt` 的 UTC 日期，`NNNN` 是當天第幾個 5 分鐘（`0001`~`0288`）。例如 UTC `00:00` 開放、`00:05` 開獎的是 `-0001`；`23:55` 開放、隔天 `00:00` 開獎的是 `-0288`。
  - 期數號只是編號，全世界一致；玩家看的時間用 `openAt` / `closeAt` / `drawAt`，由前端轉成當地時間。
  - 開獎時間對齊整點（`:00`、`:05`…），同一個時間點永遠算出同一個期數號，加上唯一索引，重啟或重跑都不會建出重複的期數。
- **`drawAt` 和 `drawnAt`**：`drawAt` 是排定的開獎時間；`drawnAt` 是實際開出號碼的時間（後端當機重啟後補開時，`drawnAt` 會比 `drawAt` 晚）。
- **定時任務**：每秒「對帳」一次，補做該做的事（建立目前這期、過了截止時間就 `CLOSED`、過了開獎時間就開獎），狀態變更一律用條件更新，重複執行安全。

- **頭獎彩池**：每期結算時記在 `draws.poolAmount`（本期彩池），滾存帶到下一期（細節在結算模組設計時定）。

## 待討論

- `draws` 是否存每個獎級的中獎注數與每注獎金（方便查詢，避免重算）
- 注單量大時，`tickets` 依 `drawNo` 建索引、結算時批量處理
