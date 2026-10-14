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
| `users` | 帳戶 | `username`、`passwordHash`、`nickname`、`roles`、`enabled`、`tokenValidAfter` | `username` |
| `wallets` | 積分餘額（每人一個） | `userId`、`balance`、`version` | `userId` |
| `wallet_transactions` | 積分流水 | `userId`、`type`、`amount`、`balanceAfter`、`refId` | `type + refId` |
| `draws` | 期數 | `drawNo`、`status`、`openAt`、`closeAt`、`drawAt`、`numbers`、`specialNumber`、`poolAmount` | `drawNo` |
| `tickets` | 注單 | `userId`、`drawNo`、`betType`、`selections`、`lines`、`cost`、`status`、`prizeTier`、`payout`、`idempotencyKey` | `userId + idempotencyKey` |

## 設計重點

- **注單預留複式、膽拖**：`betType`（`SINGLE` / `MULTIPLE` / `BANKER`）+ 玩家原始選號 `selections`，再展開成一注一注的 `lines`。單式時 `lines` 只有一注。
- **扣積分防並發**：`updateOne({ userId, balance: { $gte: cost } }, { $inc: { balance: -cost } })`，餘額檢查和扣減是同一個原子操作。
- **下注是一個事務**：扣餘額 + 寫流水 + 建立注單，三件事要麼都成功、要麼都失敗（需要副本集）。
- **期數號 `drawNo`**：格式待定（例如 `20261014-0001`，一天 288 期）。

## 待討論

- `wallet_transactions.type` 的完整列表
- `draws` 是否存每個獎級的中獎注數與每注獎金（方便查詢，避免重算）
- 注單量大時，`tickets` 依 `drawNo` 建索引、結算時批量處理
