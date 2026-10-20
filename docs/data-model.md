# 資料模型（草稿）

MongoDB，資料庫名 `marksixlab`。**草稿**：階段 0 逐個集合討論定稿後，再開始寫代碼。

## 通用約定

- 時間用 `Instant`（UTC），審計字段 `createdAt` / `updatedAt` 由 `@CreatedDate` / `@LastModifiedDate` 自動填。
- 積分用 `long` 整數。
- 「只能發生一次」的事情一律加**唯一索引**，不只靠程式先查再寫。
- 會被並發修改的文件加 `@Version` 樂觀鎖。

## 集合一覽

| 集合 | 用途 | 主要字段（暫定） | 唯一索引 |
|---|---|---|---|
| `users` | 帳戶 | `username`、`passwordHash`、`nickname`、`roles`、`enabled` | `username` |
| `wallets` | 積分餘額（每人一個） | `userId`、`balance`、`version` | `userId` |
| `wallet_transactions` | 積分流水 | `userId`、`type`、`amount`、`balanceAfter`、`refId` | `type + refId` |
| `draws` | 期數 | `drawNo`、`status`、`openAt`、`closeAt`、`drawAt`、`numbers`、`specialNumber`、`drawnAt`、`poolAmount` | `drawNo` |
| `tickets` | 注單 | `userId`、`drawNo`、`betType`、`selections`、`lines`、`cost`、`status`、`prizeTier`、`payout`、`idempotencyKey` | `userId + idempotencyKey` |

## 設計重點

- **注單預留複式、膽拖**：`betType`（`SINGLE` / `MULTIPLE` / `BANKER`）+ 玩家原始選號 `selections`，再展開成一注一注的 `lines`。單式時 `lines` 只有一注。
- **扣積分防並發**：`updateOne({ userId, balance: { $gte: cost } }, { $inc: { balance: -cost } })`，餘額檢查和扣減是同一個原子操作。
- **下注是一個事務**：扣餘額 + 寫流水 + 建立注單，三件事要麼都成功、要麼都失敗（需要副本集）。
- **登入 session 不存 MongoDB**：Redis `session:{userId}` 存目前有效的 session id（TTL = JWT 有效期），JWT 帶同一個 id；不一致代表被新登入踢掉。登出就刪 key。
- **期數號 `drawNo`**：`yyyyMMdd-NNNN`，**以 UTC 計算**，由開放時間 `openAt` 推出：日期是 `openAt` 的 UTC 日期，`NNNN` 是當天第幾個 5 分鐘（`0001`~`0288`）。例如 UTC `00:00` 開放、`00:05` 開獎的是 `-0001`；`23:55` 開放、隔天 `00:00` 開獎的是 `-0288`。
  - 期數號只是編號，全世界一致；玩家看的時間用 `openAt` / `closeAt` / `drawAt`，由前端轉成當地時間。
  - 開獎時間對齊整點（`:00`、`:05`…），同一個時間點永遠算出同一個期數號，加上唯一索引，重啟或重跑都不會建出重複的期數。
- **`drawAt` 和 `drawnAt`**：`drawAt` 是排定的開獎時間；`drawnAt` 是實際開出號碼的時間（後端當機重啟後補開時，`drawnAt` 會比 `drawAt` 晚）。
- **定時任務**：每秒「對帳」一次，補做該做的事（建立目前這期、過了截止時間就 `CLOSED`、過了開獎時間就開獎），狀態變更一律用條件更新，重複執行安全。

## 待討論

- `wallet_transactions.type` 的完整列表
- `draws` 是否存每個獎級的中獎注數與每注獎金（方便查詢，避免重算）
- 注單量大時，`tickets` 依 `drawNo` 建索引、結算時批量處理
