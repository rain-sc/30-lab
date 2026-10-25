# 12 聚合管線：排行榜、冷熱號碼

## 1. 要解決什麼問題

「今天誰中最多？」要把今天所有的派彩流水**依人加總、排序、算名次**。用 `find` 做不到，要用**聚合管線（Aggregation Pipeline）**。

SQL 會這樣寫：

```sql
SELECT user_id, SUM(amount) AS amount,
       RANK() OVER (ORDER BY SUM(amount) DESC) AS rank
FROM wallet_transactions
WHERE type = 'PAYOUT' AND created_at >= '2026-10-23' AND created_at < '2026-10-24'
GROUP BY user_id
ORDER BY rank, user_id;
```

## 2. 管線 = 資料流過一連串的關卡

```
所有文件 → [$match] → [$group] → [$setWindowFields] → [$sort] → 結果
```

每一個關卡（stage）接收上一關的輸出、加工後交給下一關。≈ JavaScript 的陣列方法鏈：

```ts
transactions
  .filter(t => t.type === 'PAYOUT' && t.createdAt >= from && t.createdAt < to)   // $match
  .reduce(groupByUserIdAndSum, ...)                                               // $group
  .map(addRank)                                                                   // $setWindowFields
  .sort(byRankThenId)                                                             // $sort
```

差別是**整個管線在資料庫裡執行**，只把最後的結果傳回 Java，不用把幾萬筆流水都搬回來。

## 3. 今日中獎榜：一個 stage 一個 stage 看

```java
// wallet/service/WalletService.java
public List<UserRank> payoutRanking(Instant from, Instant to) {
    Aggregation aggregation = Aggregation.newAggregation(
            Aggregation.match(Criteria.where("type").is(WalletTransactionType.PAYOUT)          // ①
                    .and("createdAt").gte(from).lt(to)),
            Aggregation.group("userId").sum("amount").as("amount"),                          // ②
            Aggregation.stage("""
                    { $setWindowFields: { sortBy: { amount: -1 }, output: { rank: { $rank: { } } } } }
                    """),                                                                     // ③
            Aggregation.stage("""
                    { $sort: { rank: 1, _id: 1 } }
                    """));                                                                    // ④
    return mongoTemplate.aggregate(aggregation, WalletTransaction.class, UserRank.class).getMappedResults();   // ⑤
}
```

假設 `wallet_transactions` 裡有這些資料（今天 = 2026-10-23）：

```js
{ userId: "A", type: "PAYOUT", amount: 160, createdAt: 2026-10-23T01:00Z }
{ userId: "B", type: "PAYOUT", amount: 56000, createdAt: 2026-10-23T02:00Z }
{ userId: "A", type: "BET",    amount: -20, createdAt: 2026-10-23T02:00Z }
{ userId: "C", type: "PAYOUT", amount: 80,  createdAt: 2026-10-23T03:00Z }
{ userId: "A", type: "PAYOUT", amount: 20,  createdAt: 2026-10-23T04:00Z }
{ userId: "B", type: "PAYOUT", amount: 20,  createdAt: 2026-10-22T23:59Z }   // 昨天
{ userId: "D", type: "PAYOUT", amount: 160, createdAt: 2026-10-23T05:00Z }
```

### ① `$match` ≈ `WHERE`

只留下「今天的派彩」：

```js
{ userId: "A", amount: 160 }
{ userId: "B", amount: 56000 }
{ userId: "C", amount: 80 }
{ userId: "A", amount: 20 }
{ userId: "D", amount: 160 }
```

`BET` 那筆和昨天那筆被濾掉了。**`$match` 要放最前面**，才能用到索引 `type_createdAt`，而且後面的 stage 處理的資料最少。

### ② `$group` ≈ `GROUP BY` + `SUM`

依 `userId` 分組，加總 `amount`。分組的依據會放在 `_id`：

```js
{ _id: "A", amount: 180 }
{ _id: "B", amount: 56000 }
{ _id: "C", amount: 80 }
{ _id: "D", amount: 160 }
```

### ③ `$setWindowFields` + `$rank` ≈ `RANK() OVER (ORDER BY amount DESC)`

依 `amount` 由大到小排，加上名次。**同分同名次，下一個名次會跳號**（1、2、2、4）：

```js
{ _id: "B", amount: 56000, rank: 1 }
{ _id: "A", amount: 180,   rank: 2 }
{ _id: "D", amount: 160,   rank: 3 }
{ _id: "C", amount: 80,    rank: 4 }
```

（如果 A 和 D 都是 160，就會是 B=1、A=2、D=2、C=4）

| 視窗函式 | SQL | 同分時 |
|---|---|---|
| `$rank` | `RANK()` | 1、2、2、4（排行榜用這個） |
| `$denseRank` | `DENSE_RANK()` | 1、2、2、3 |
| `$documentNumber` | `ROW_NUMBER()` | 1、2、3、4（冷熱號碼用這個） |

### ④ `$sort`

依名次排序，同名次再依 `_id` 排，**讓順序固定**（不然每次重新整理，同分的人順序可能會跳來跳去）。

### ⑤ 結果轉成 Java 物件

```java
// wallet/dto/UserRank.java
public record UserRank(@Id String userId, long amount, int rank) { }
```

`@Id` 讓 `_id` 對應到 `userId`。最後得到 `List<UserRank>`。

### Java 方法 vs 字串 stage

| 寫法 | 優點 | 用在 |
|---|---|---|
| `Aggregation.match(Criteria...)`、`Aggregation.group(...)` | 有型別檢查，enum 自動轉字串 | 簡單的 stage |
| `Aggregation.stage("""...""")` | 直接貼 MongoDB 語法，什麼都能寫 | `$setWindowFields`、`$lookup` 這種 Spring 沒有方便方法的 |

> 開發技巧：複雜的管線**先在 mongosh / DataGrip 寫好、跑出正確結果**，再貼進 `Aggregation.stage("""...""")`。
>
> ⚠️ 字串 stage 產生的新欄位（例如 `rank`），Spring 不知道它的存在。後面的 stage 要用到它，也要用字串 stage 寫（所以 ④ 的 `$sort` 是字串）。

## 4. 富豪榜：`$lookup` ≈ JOIN

「餘額最多的人」，但**只列出下注過的人**（不然一堆只註冊、沒玩過的帳號都是 10,000）。

```java
// wallet/service/WalletService.java
public List<UserRank> balanceRanking() {
    Aggregation aggregation = Aggregation.newAggregation(
            Aggregation.stage("""
                    { $lookup: {
                        from: "wallet_transactions",              // 去哪個集合找
                        localField: "userId",                     // 錢包的 userId
                        foreignField: "userId",                   // 對應流水的 userId
                        pipeline: [ { $match: { type: "BET" } }, { $limit: 1 } ],   // 只要找到一筆 BET 就夠了
                        as: "bets"                                // 結果放進 bets 陣列
                    } }
                    """),
            Aggregation.stage("""
                    { $match: { bets: { $ne: [] } } }            // bets 不是空的 = 下注過
                    """),
            Aggregation.stage("""
                    { $setWindowFields: { sortBy: { balance: -1 }, output: { rank: { $rank: {} } } } }
                    """),
            Aggregation.stage("""
                    { $project: { _id: "$userId", amount: "$balance", rank: 1 } }   // 改欄位名稱，對應 UserRank
                    """),
            Aggregation.stage("""
                    { $sort: { rank: 1, _id: 1 } }
                    """));
    return mongoTemplate.aggregate(aggregation, Wallet.class, UserRank.class).getMappedResults();
}
```

SQL 對照：

```sql
SELECT w.user_id, w.balance AS amount, RANK() OVER (ORDER BY w.balance DESC) AS rank
FROM wallets w
WHERE EXISTS (SELECT 1 FROM wallet_transactions t WHERE t.user_id = w.user_id AND t.type = 'BET')
```

- `pipeline` 裡的 `$limit: 1`：只要知道「有沒有」，找到一筆就停，不用把每個人幾千筆下注都拉進來
- `$project` ≈ `SELECT 欄位 AS 新名稱`：把 `balance` 改名成 `amount`，這樣中獎榜和富豪榜都能用同一個 `UserRank`

> **`$lookup` 只能用在同一個模組裡**。`wallets` 和 `wallet_transactions` 都屬於 wallet 模組，所以可以。要暱稱（`users`，account 模組）時**不能** `$lookup`，要透過 `UserService`（第 8 章最後）。

## 5. 最近 10 次中獎：`$topN`

排行榜每個人要附上「最近 10 次中獎」：

```java
// betting/service/BettingService.java
public Map<String, List<RecentWin>> recentWins(Collection<String> userIds, int limit) {
    if (userIds.isEmpty()) {
        return Map.of();
    }
    Aggregation aggregation = Aggregation.newAggregation(
            Aggregation.match(Criteria.where("userId").in(userIds).and("status").is(TicketStatus.PAID)),
            Aggregation.stage("""
                    { $group: {
                        _id: "$userId",
                        wins: { $topN: {
                            n: %d,
                            sortBy: { settledAt: -1 },
                            output: { drawNo: "$drawNo", settledAt: "$settledAt", payout: "$payout", results: "$results" }
                        } }
                    } }
                    """.formatted(limit)));
    ...
}
```

`$topN` 放在 `$group` 裡：**每一組各自**取前 N 筆。≈ SQL：

```sql
SELECT * FROM (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY settled_at DESC) AS rn
  FROM tickets WHERE user_id IN (...) AND status = 'PAID'
) t WHERE rn <= 10
```

- `.formatted(limit)` 把 `%d` 換成 10（文字區塊不能直接插變數）
- 用到索引 `userId_status_settledAt`（等於、等於、排序，第 8 章的 ESR 規則）：只會讀中獎的注單

## 6. 組合三個模組的資料：`LeaderboardService`

排行榜需要：名次（wallet）、暱稱（account）、最近中獎（betting）。`stats` 模組分別問三個模組，再組合起來：

```java
// stats/service/LeaderboardService.java
private Board board(List<UserRank> ranking, String userId) {
    List<UserRank> top = ranking.stream().limit(TOP).toList();               // 前 20 名
    UserRank mine = ranking.stream()
            .filter(row -> row.userId().equals(userId))                      // 自己的名次（可能在 20 名外）
            .findFirst()
            .orElse(null);

    Set<String> userIds = new HashSet<>();                                   // 需要查的人：前 20 + 自己
    top.forEach(row -> userIds.add(row.userId()));
    if (mine != null) {
        userIds.add(mine.userId());
    }
    Map<String, String> nicknames = userService.nicknames(userIds);                          // 一次查完所有暱稱
    Map<String, List<RecentWin>> recentWins = bettingService.recentWins(userIds, RECENT_WINS); // 一次查完所有最近中獎

    List<LeaderboardEntry> entries = top.stream()
            .map(row -> toEntry(row, nicknames, recentWins, userId))
            .toList();
    LeaderboardEntry mineEntry = mine == null ? null : toEntry(mine, nicknames, recentWins, userId);
    return new Board(entries, mineEntry);
}
```

**重點：「一次查完」**。如果在迴圈裡對每個人查一次暱稱，20 個人就是 20 次資料庫查詢（N+1 問題）。先收集所有 userId，`findAllById` 一次查回來，放進 `Map` 再對照。≈ 前端用 DataLoader 把多個請求合併成一個。

### 「今天」「本週」的範圍

```java
// stats/dto/LeaderboardPeriod.java
public LocalDate firstDay(Instant now) {
    LocalDate today = LocalDate.ofInstant(now, ZoneOffset.UTC);
    return switch (this) {
        case DAY -> today;
        case WEEK -> today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));   // 本週一（今天是週一就是今天）
    };
}
```

範圍是 `[firstDay 00:00, firstDay + 天數 00:00)`，左閉右開：`gte(from).lt(to)`。

## 7. 什麼時候不用聚合

「每期中獎名單」要找出每個人的**最高獎級**。獎級在 MongoDB 裡存成字串，字串比較 `"FIFTH" < "FOURTH"`（F-I < F-O），**順序是錯的**。

一期最多幾十張中獎注單，資料量很小，所以 `DrawWinnersService` 直接把注單拿回 Java，用 enum 的順序比較。

> 原則：**資料量大、只要結果** → 聚合；**資料量小、邏輯複雜** → 拿回 Java 處理，好寫好測。

## 8. 冷熱號碼（進階）

`NumberStatsService` 統計最近 N 期每個號碼開出幾次、隔了幾期沒開。用到幾個新的 stage：

| Stage | 作用 | 這裡做什麼 |
|---|---|---|
| `$sort` + `$limit` | 最近 N 期 | |
| `$setWindowFields` + `$documentNumber` | 每期編號 1、2、3… | 最新一期是 1，用來算「隔了幾期沒開」 |
| `$project` + `$concatArrays` + `$map` | 改變文件形狀 | 把 6 個正碼和特別號碼合成一個 `balls` 陣列，每顆標記是不是特別號碼 |
| `$unwind` | 把陣列拆成多份文件 | 一期 → 7 份文件，每份一顆球。≈ SQL `CROSS JOIN LATERAL unnest(...)` |
| `$group` + `$cond` | 依號碼分組、條件加總 | 正碼次數、特別號碼次數、最近一次是第幾期 |

最後在 Java 裡用 `IntStream.rangeClosed(1, maxNumber)` 補上**從沒開過的號碼**（聚合結果裡不會有它們）。

---

## 小練習

1. 在 mongosh 把今日中獎榜的管線**一個 stage 一個 stage**加上去跑，看每一步的輸出：
   ```js
   use thirtylab
   db.wallet_transactions.aggregate([
     { $match: { type: "PAYOUT", createdAt: { $gte: ISODate("2026-10-23"), $lt: ISODate("2026-10-24") } } },
     // 先跑到這裡看結果，再一個一個把下面的加上去
     { $group: { _id: "$userId", amount: { $sum: "$amount" } } },
     { $setWindowFields: { sortBy: { amount: -1 }, output: { rank: { $rank: {} } } } },
     { $sort: { rank: 1, _id: 1 } }
   ])
   ```
2. 把上面的 `$rank` 換成 `$denseRank`，名次有什麼不同？
3. 對第 1 題的管線加 `.explain("executionStats")`，`$match` 有沒有用到 `type_createdAt` 索引？
4. 如果 `LeaderboardService` 改成在 `map` 裡對每個人呼叫一次 `userService.nicknames(Set.of(row.userId()))`，結果會一樣嗎？效能差在哪？
5. 為什麼「最高獎級」不能在 MongoDB 用 `$min: "$results.tier"` 算？

上一章：[11 結算派彩](11-settlement.md)　下一章：[13 WebSocket](13-websocket.md)
