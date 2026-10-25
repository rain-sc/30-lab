# 08 MongoDB 與 Spring Data

## 1. MongoDB 是什麼（從 PostgreSQL 的角度）

| PostgreSQL | MongoDB | 這個專案 |
|---|---|---|
| database | database | `thirtylab`（測試用 `thirtylab_test`） |
| table | **collection（集合）** | `users`、`wallets`、`wallet_transactions`、`tickets`、`draws` |
| row | **document（文件）**，長得像 JSON | 一張注單、一期 |
| column | field（欄位） | **每份文件的欄位可以不一樣** |
| `id SERIAL` / UUID | `_id`，預設是 `ObjectId` | `6adb1a816ae6eccdf16f4d01` |
| `CREATE TABLE`（先定義結構） | 不用，直接寫入 | 結構由 Java 的 model class 決定 |
| `JOIN` | `$lookup`（少用） | 大部分在 Java 裡組合 |
| 子表（一對多） | **把陣列直接放在文件裡** | 注單的 `lines`、期數的 `prizeSummary` |
| `UNIQUE` | 唯一索引 | `wallet_transactions` 的 `type + refId` |
| 交易 | 交易（**需要副本集**） | Docker 跑的是單節點副本集 `rs0` |

### 一份注單長怎樣

```json
{
  "_id": { "$oid": "6adb2b1c..." },
  "userId": "6adb1a81...",
  "drawNo": "20261023-0110",
  "betType": "SINGLE",
  "lines": [ [3, 11, 18, 27, 29, 30], [1, 2, 3, 4, 5, 6] ],
  "cost": 20,
  "status": "PAID",
  "idempotencyKey": "3f1c2a9e-...",
  "results": [
    { "matched": 3, "specialHit": false, "tier": "SEVENTH", "prize": 20 },
    { "matched": 1, "specialHit": false, "tier": null, "prize": 0 }
  ],
  "payout": 20,
  "settledAt": { "$date": "2026-10-23T09:10:01.123Z" },
  "createdAt": { "$date": "2026-10-23T09:07:12.456Z" },
  "updatedAt": { "$date": "2026-10-23T09:10:01.200Z" },
  "_class": "com.thirtylab.betting.model.Ticket"
}
```

如果用 PostgreSQL，`lines` 和 `results` 要另外開一張 `ticket_lines` 表，用 `ticket_id` 關聯，讀一張注單要 JOIN。MongoDB 直接放在同一份文件，**一次讀出來**。

### 什麼時候放在一起、什麼時候分開

| 放在同一份文件（嵌入） | 分成不同集合 |
|---|---|
| 總是一起讀、一起寫 | 需要單獨查詢 |
| 數量有上限 | 會一直增加 |
| 注單的 `lines`（最多 50 注）、`results`；期數的 `prizeSummary`（固定 7 個獎級） | 積分流水 `wallet_transactions`：每個人會有幾千筆，**不能**塞在錢包文件裡 |

MongoDB 單一文件上限 16 MB，而且文件越大，每次讀寫越慢。

## 2. 用工具看資料

連線字串：`mongodb://localhost:27018/?directConnection=true`

```powershell
# 用 Docker 裡的 mongosh（MongoDB 的命令列）
docker exec -it tl-mongodb mongosh --port 27018
```

```js
use thirtylab
db.getCollectionNames()                              // ≈ \dt
db.wallets.find().limit(3)                           // ≈ SELECT * FROM wallets LIMIT 3
db.draws.find({ status: "SETTLED" }).sort({ drawAt: -1 }).limit(1)
db.tickets.countDocuments({ drawNo: "20261023-0110" })
db.tickets.getIndexes()                              // 看索引
```

| SQL | MongoDB |
|---|---|
| `SELECT * FROM t WHERE a = 1` | `db.t.find({ a: 1 })` |
| `WHERE a > 1 AND b IN (1,2)` | `find({ a: { $gt: 1 }, b: { $in: [1, 2] } })` |
| `ORDER BY a DESC LIMIT 10` | `.sort({ a: -1 }).limit(10)` |
| `UPDATE t SET a = 2 WHERE id = 1` | `db.t.updateOne({ _id: 1 }, { $set: { a: 2 } })` |
| `UPDATE t SET n = n + 5` | `updateOne(..., { $inc: { n: 5 } })` |
| `SELECT COUNT(*)` | `countDocuments({...})` |

## 3. Model：Java class ↔ MongoDB 文件

```java
// betting/model/Ticket.java
@Getter
@Setter
@NoArgsConstructor
@Document("tickets")                                                    // ① 存在哪個集合
@CompoundIndex(name = "userId_idempotencyKey", def = "{'userId': 1, 'idempotencyKey': 1}", unique = true)   // ②
@CompoundIndex(name = "userId_createdAt", def = "{'userId': 1, 'createdAt': -1}")
@CompoundIndex(name = "drawNo_status", def = "{'drawNo': 1, 'status': 1}")
@CompoundIndex(name = "userId_status_settledAt", def = "{'userId': 1, 'status': 1, 'settledAt': -1}")
public class Ticket {

    @Id                                         // ③ 對應 _id
    private String id;

    private String userId;
    private String drawNo;
    private BetType betType;                    // ④ enum 存成字串 "SINGLE"
    private List<List<Integer>> lines;          // ⑤ 巢狀陣列直接存
    private long cost;
    private TicketStatus status;
    private String idempotencyKey;
    private List<LineResult> results;           // ⑥ record 存成子文件
    private long payout;
    private Instant settledAt;

    @CreatedDate                                // ⑦ 第一次存的時候自動填
    private Instant createdAt;

    @LastModifiedDate                           // ⑦ 每次用 save 存都會更新
    private Instant updatedAt;
}
```

| 編號 | 意思 |
|---|---|
| ① | `@Document("tickets")`：沒寫的話，集合名稱是 class 名稱轉小寫 |
| ② | 索引（第 5 節）。`1` 是升冪、`-1` 是降冪 |
| ③ | `String id` 對應 `_id`。存的時候 `id` 是 null，MongoDB 會自動產生 ObjectId，存完 `id` 會被填上 |
| ④ | enum 存成名稱字串 |
| ⑤ ⑥ | `List`、record、其他 class 都會自動轉成陣列、子文件 |
| ⑦ | Auditing：需要 `MongoConfig` 的 `@EnableMongoAuditing` |

### `MongoConfig`

```java
// config/MongoConfig.java
@Configuration
@EnableMongoAuditing(dateTimeProviderRef = "millisDateTimeProvider")   // 開啟 @CreatedDate / @LastModifiedDate
public class MongoConfig {

    @Bean
    public DateTimeProvider millisDateTimeProvider() {
        return () -> Optional.of(Instant.now().truncatedTo(ChronoUnit.MILLIS));   // 截到毫秒
    }

    @Bean
    public MongoTransactionManager transactionManager(MongoDatabaseFactory factory) {
        return new MongoTransactionManager(factory);                  // 讓 @Transactional 能用在 MongoDB
    }
}
```

**為什麼要截到毫秒？** Java 的 `Instant` 精確到奈秒，MongoDB 的日期只存到毫秒。不截的話，存進去再讀出來的時間會跟原本的不一樣，測試比對 `isEqualTo` 會失敗。

### `_class` 欄位

Spring Data 每次存文件，會多寫一個 `_class: "com.thirtylab.betting.model.Ticket"`（完整類別名稱）。讀回來時用它決定要建立哪個 class（有繼承的時候才真的需要）。

> ⚠️ 代價：**資料庫裡記住了 Java 的 package 名稱**。上線後才改 package，舊文件的 `_class` 就對不上，要寫遷移腳本。所以 `com.marksixlab` → `com.thirtylab` 這次改名，是趁還沒上線、資料庫一起換新的時候做的。

## 4. Repository：用方法名稱產生查詢

```java
// draw/repository/DrawRepository.java
public interface DrawRepository extends MongoRepository<Draw, String> {
    Optional<Draw> findByDrawNo(String drawNo);
    Optional<Draw> findFirstByStatusInOrderByDrawAtDesc(Collection<DrawStatus> statuses);
    Page<Draw> findByStatusIn(Collection<DrawStatus> statuses, Pageable pageable);
    Optional<Draw> findFirstByStatusOrderByDrawAtAsc(DrawStatus status);
    Optional<Draw> findFirstByStatusAndDrawAtBeforeOrderByDrawAtDesc(DrawStatus status, Instant drawAt);
    long countByStatusIn(Collection<DrawStatus> statuses);
    List<Draw> findByStatusAndPrizeSummaryIsNull(DrawStatus status);
}
```

Spring Data 把方法名稱拆開來解讀：

```
findFirst  By  Status  And  DrawAt Before  OrderBy DrawAt Desc
   │        │    │      │      │     │         │      │    │
 只要第一筆  條件  status = ?  且  drawAt < ?    依 drawAt  降冪
```

產生的查詢：`db.draws.find({ status: ?, drawAt: { $lt: ? } }).sort({ drawAt: -1 }).limit(1)`。參數依順序對應方法參數。

| 關鍵字 | 意思 | 例子 |
|---|---|---|
| `findBy` | 查（回傳 `List` 或 `Optional`） | `findByDrawNo` |
| `findFirstBy` | 只要第一筆 | `findFirstByStatusOrderByDrawAtAsc` |
| `existsBy` | 有沒有（`boolean`） | `existsByTypeAndRefId` |
| `countBy` | 幾筆（`long`） | `countByStatusIn` |
| `And` / `Or` | 條件組合 | |
| `In` | 在清單裡（`$in`） | `findByStatusIn` |
| `Before` / `After` / `GreaterThan` | 比較 | `DrawAtBefore` |
| `IsNull` | null **或欄位不存在** | `PrizeSummaryIsNull` |
| `OrderByXxxAsc/Desc` | 排序 | |
| 最後一個參數是 `Pageable` | 分頁，回傳 `Page<T>` | `findByStatusIn(..., pageable)` |

**方法名稱打錯（例如欄位名稱拼錯），啟動時就會失敗**，不用等到執行。

繼承 `MongoRepository` 之後自動擁有的方法：`save`（有 id 就更新，沒有就新增）、`insert`（一定新增，id 重複就失敗）、`findById`、`findAllById`、`findAll`、`deleteById`、`count`。

## 5. 索引

### 為什麼要索引

沒有索引時，`db.tickets.find({ drawNo: "20261023-0110" })` 要**一份一份看過所有注單**（COLLSCAN，全表掃描）。注單有幾十萬張時就很慢。索引 ≈ 書最後面的索引頁，直接翻到要的那幾頁。

### 這個專案的索引

| 集合 | 索引 | 給誰用 |
|---|---|---|
| `users` | `username`（唯一） | 登入、檢查帳號重複 |
| `wallets` | `userId`（唯一） | 一人一個錢包 |
| `wallet_transactions` | `type + refId`（唯一） | **冪等**：同一件事只記一次（第 9 章） |
| | `userId + createdAt` | 我的積分流水 |
| | `type + createdAt` | 排行榜：某段時間的派彩 |
| `tickets` | `userId + idempotencyKey`（唯一） | 下注冪等 |
| | `userId + createdAt` | 我的注單 |
| | `drawNo + status` | 結算、中獎名單 |
| | `userId + status + settledAt` | 最近 10 次中獎 |
| `draws` | `drawNo`（唯一）、`drawAt` | 期數 |

`application.properties` 的 `spring.data.mongodb.auto-index-creation=true` 讓 Spring 啟動時依照 `@Indexed`、`@CompoundIndex` 自動建立。

### 複合索引的欄位順序：ESR 規則

複合索引 `userId + status + settledAt` ≈ 電話簿先依姓、再依名排序。**要從最左邊的欄位開始用**，只知道名字是查不到的。

欄位順序的原則：**E**quality（等於）→ **S**ort（排序）→ **R**ange（範圍）

- 「某人（等於）、已派彩的（等於）、依結算時間排序（排序）」→ `userId, status, settledAt`
- 「派彩類型（等於）、某段時間（範圍）」→ `type, createdAt`

### 確認有沒有用到索引

```js
db.tickets.find({ userId: "6adb...", status: "PAID" }).sort({ settledAt: -1 }).explain("executionStats")
```

看結果裡的：
- `IXSCAN` + `indexName: "userId_status_settledAt"` → 有用到索引 ✅
- `COLLSCAN` → 全部掃過一遍 ❌
- `totalDocsExamined`：讀了幾份文件。越接近回傳的筆數越好

## 6. MongoTemplate：Repository 做不到的時候

方法名稱只能表達簡單的查詢。**條件更新**、**原子的加減**、**聚合**要用 `MongoTemplate`。

### 條件更新：狀態機的核心

```java
// betting/service/BettingService.java
public void markPaid(String ticketId, Instant now) {
    Query query = Query.query(Criteria.where("_id").is(ticketId).and("status").is(TicketStatus.WON));
    Update update = new Update()
            .set("status", TicketStatus.PAID)
            .set("updatedAt", now);
    mongoTemplate.updateFirst(query, update, Ticket.class);
}
```

SQL 對照：

```sql
UPDATE tickets SET status = 'PAID', updated_at = ? WHERE id = ? AND status = 'WON';
```

**`AND status = 'WON'` 是關鍵**：只有「目前是 WON」的才會被改成 PAID。已經是 PAID 的，條件不符，什麼都不會發生。所以這行**執行兩次也沒關係**（冪等，第 11 章的核心）。

| Java | 意思 |
|---|---|
| `Criteria.where("a").is(x)` | `a = x` |
| `.and("b").gte(y)` | `AND b >= y` |
| `.lte(y)` / `.lt(y)` / `.in(list)` | `<=` / `<` / `IN` |
| `new Update().set("a", x)` | `SET a = x` |
| `.inc("balance", -10)` | `SET balance = balance - 10` |
| `.setOnInsert("a", x)` | 只有新增時才設定 |
| `updateFirst(query, update, X.class)` | 改符合條件的第一筆，回傳改了幾筆 |
| `findAndModify(query, update, options, X.class)` | 改完**把文件回傳**（≈ `RETURNING *`） |

### 原子的扣款

```java
// wallet/service/WalletService.java
Wallet wallet = mongoTemplate.findAndModify(
        Query.query(Criteria.where("userId").is(userId).and("balance").gte(amount)),   // 餘額 >= 要扣的錢
        new Update().inc("balance", -amount).set("updatedAt", now()),                  // 才扣
        FindAndModifyOptions.options().returnNew(true),                                // 回傳扣完之後的文件
        Wallet.class);
if (wallet == null) {                                                                  // 條件不符 = 餘額不夠
    throw new BusinessException(ErrorCode.INSUFFICIENT_POINTS);
}
```

**為什麼不先讀餘額、再判斷、再寫回去？**

```java
// ❌ 有問題的寫法
Wallet w = walletRepository.findByUserId(userId).get();   // 讀到 100
if (w.getBalance() < 100) throw ...;                     // 夠
w.setBalance(w.getBalance() - 100);                      // 100 - 100 = 0
walletRepository.save(w);
```

兩個請求**同時**進來：兩個都讀到 100、都判斷夠、都寫回 0 → **扣了 200，餘額卻是 0**。

`findAndModify` 把「檢查」和「扣款」合成**資料庫裡的一個原子操作**，同時進來的請求會排隊，第二個執行時餘額已經是 0，條件 `balance >= 100` 不成立，回傳 `null`。

### upsert：沒有就新增

```java
// wallet/service/WalletService.java 的 open()
return mongoTemplate.findAndModify(
        Query.query(Criteria.where("userId").is(userId)),
        new Update().setOnInsert("balance", bonus).setOnInsert("createdAt", now).setOnInsert("updatedAt", now),
        FindAndModifyOptions.options().upsert(true).returnNew(true),
        Wallet.class);
```

- `upsert(true)`：找不到 `userId` 的錢包就**新增一份**
- `setOnInsert`：只有新增時才設定這些值；已經存在就什麼都不改
- 兩個請求同時開戶，也只會有一個錢包（`userId` 有唯一索引）

≈ SQL `INSERT ... ON CONFLICT (user_id) DO NOTHING RETURNING *`。

## 7. Repository 還是 MongoTemplate？

| 用 Repository | 用 MongoTemplate |
|---|---|
| 依條件查詢、存一整份新文件 | 只改幾個欄位 |
| `findByDrawNo`、`insert(ticket)` | **條件更新**（狀態轉換）、`$inc`、upsert |
| 分頁查詢 | 聚合（第 12 章） |

> ⚠️ 用 `save(整份文件)` 更新有風險：你讀出來到存回去之間，別人改了某個欄位，`save` 會**把別人的修改蓋掉**。只改特定欄位時用 `Update().set(...)`。

## 8. 模組邊界：不能用別人的 Repository

```java
// stats/service/LeaderboardService.java
private final WalletService walletService;     // ✅ 用 wallet 模組的 Service
private final UserService userService;         // ✅ 用 account 模組的 Service
private final BettingService bettingService;   // ✅ 用 betting 模組的 Service
// private final UserRepository userRepository;   ❌ 不能直接用別的模組的 Repository
```

排行榜要暱稱，暱稱在 `users` 集合，屬於 `account` 模組。所以 `stats` 呼叫 `userService.nicknames(userIds)`，由 `account` 自己去查。

**為什麼要這樣？** `account` 以後要改 `users` 的結構（例如暱稱搬到別的集合），只要改 `account` 模組裡面，其他模組完全不受影響。≈ 前端的元件只透過 props / hooks 拿資料，不直接去讀別的元件的 state。

---

## 小練習

1. 用 mongosh 找出你自己帳號的錢包，再找出你的所有積分流水，依時間排序。
2. 對 `db.wallet_transactions.find({ type: "PAYOUT", createdAt: { $gte: ISODate("2026-10-23") } })` 跑 `explain("executionStats")`，有用到哪個索引？
3. `findFirstByStatusOrderByDrawAtAsc(DrawStatus.DRAWN)` 翻成 mongosh 的查詢是什麼？它是在找哪一期？（提示：第 11 章結算）
4. 如果 `debit` 改成「先 `findByUserId` 讀出來、判斷、再 `save`」，在什麼情況下會出錯？
5. 為什麼 `wallet_transactions` 不做成錢包文件裡的一個陣列？

上一章：[07 登入](07-security-login.md)　下一章：[09 下注](09-betting-transactions.md)
