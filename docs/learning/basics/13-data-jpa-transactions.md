# S4 資料存取與交易

30 Lab 用 MongoDB（[專案教程第 8 章](../backend/08-mongodb.md)）。但大部分 Java 後端的工作用的是**關聯式資料庫 + JPA**，面試也幾乎一定會問。你熟悉 PostgreSQL，這章從 SQL 的角度講 JPA。

## 1. Java 存取資料庫的層次

```
你的程式
 ├─ Spring Data JPA       只寫 Repository interface，方法名稱產生查詢       ≈ Prisma / TypeORM Repository
 ├─ JPA（規格）/ Hibernate（實作）  物件 ↔ 資料表的對應（ORM）                ≈ TypeORM 的核心
 ├─ JdbcTemplate / JdbcClient    自己寫 SQL，Spring 幫你處理連線、例外          ≈ knex / pg 的 query
 └─ JDBC                   最底層的 Java 資料庫 API                          ≈ pg driver
     └─ 連線池（HikariCP）   重複使用資料庫連線                               ≈ pg Pool
```

## 2. 設定

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-jpa</artifactId>
</dependency>
<dependency>
    <groupId>org.postgresql</groupId>
    <artifactId>postgresql</artifactId>
    <scope>runtime</scope>
</dependency>
```

```properties
spring.datasource.url=jdbc:postgresql://localhost:5432/shop
spring.datasource.username=shop
spring.datasource.password=${DB_PASSWORD}
spring.jpa.hibernate.ddl-auto=validate     # 只檢查資料表結構跟 Entity 對不對得上（正式環境用這個）
spring.jpa.show-sql=true                   # 開發時印出 SQL
spring.jpa.open-in-view=false              # 建議關掉（見第 6 節）
```

| `ddl-auto` | 做什麼 | 什麼時候用 |
|---|---|---|
| `none` / `validate` | 不改資料表 / 只檢查 | **正式環境**（資料表由遷移工具管理） |
| `update` | 自動加欄位（不會刪） | 只在自己的玩具專案 |
| `create-drop` | 啟動時建、關閉時刪 | 測試 |

## 3. Entity：Java class ↔ 資料表

```java
@Entity
@Table(name = "orders")
@Getter @Setter @NoArgsConstructor
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)       // ≈ SERIAL / IDENTITY
    private Long id;

    @Column(nullable = false, length = 64)
    private String customerName;

    @Enumerated(EnumType.STRING)                               // ⚠️ 一定要 STRING，預設的 ORDINAL 存數字，enum 順序一改資料就錯
    private OrderStatus status;

    private long totalCents;

    @CreationTimestamp
    private Instant createdAt;

    @Version                                                   // 樂觀鎖（見第 8 節）
    private long version;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<OrderItem> items = new ArrayList<>();
}

@Entity
public class OrderItem {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)                         // 外鍵 order_id
    @JoinColumn(name = "order_id")
    private Order order;

    private String productName;
    private int quantity;
}
```

| JPA | SQL |
|---|---|
| `@Entity` / `@Table` | 一張資料表 |
| `@Id` + `@GeneratedValue` | 主鍵 |
| `@Column` | 欄位 |
| `@ManyToOne` + `@JoinColumn` | 外鍵 |
| `@OneToMany(mappedBy)` | 反向的關聯（不會產生欄位） |
| `@ManyToMany` + `@JoinTable` | 中介表 |

> Entity **不要用 record**（JPA 需要無參數建構子和可變的欄位），也**不要直接當 API 的回應**（會把關聯、內部欄位都輸出，還可能觸發 N+1），一律轉成 DTO。

## 4. Repository

```java
public interface OrderRepository extends JpaRepository<Order, Long> {

    // 方法名稱產生查詢：跟 Spring Data MongoDB 一模一樣的規則
    List<Order> findByStatusOrderByCreatedAtDesc(OrderStatus status);
    boolean existsByCustomerName(String name);
    Page<Order> findByCustomerName(String name, Pageable pageable);

    // 自己寫 JPQL（查的是 Entity 和欄位名稱，不是資料表名稱）
    @Query("select o from Order o where o.totalCents > :min and o.status = :status")
    List<Order> findBig(@Param("min") long min, @Param("status") OrderStatus status);

    // 原生 SQL
    @Query(value = "select * from orders where created_at > now() - interval '1 day'", nativeQuery = true)
    List<Order> findToday();

    // 更新
    @Modifying
    @Query("update Order o set o.status = :to where o.id = :id and o.status = :from")
    int transition(@Param("id") long id, @Param("from") OrderStatus from, @Param("to") OrderStatus to);   // 回傳改了幾筆
}
```

最後那個就是 30 Lab 裡 `MongoTemplate` 做的「條件更新」，SQL 版本。

### 投影：只拿需要的欄位

```java
public record OrderSummary(Long id, String customerName, long totalCents) { }

@Query("select new com.example.OrderSummary(o.id, o.customerName, o.totalCents) from Order o")
List<OrderSummary> summaries();

// 或用 interface 投影
interface OrderNameOnly { String getCustomerName(); }
List<OrderNameOnly> findByStatus(OrderStatus status);
```

## 5. 持久化狀態與「髒檢查」

這是 JPA 跟 TypeORM / Prisma 最不一樣的地方：

```java
@Transactional
public void ship(long orderId) {
    Order order = orderRepository.findById(orderId).orElseThrow();
    order.setStatus(OrderStatus.SHIPPED);
    // 沒有呼叫 save！交易結束時 Hibernate 發現 order 被改過，自動 UPDATE
}
```

在交易裡讀出來的 Entity 是「受管理的」（managed），Hibernate 會記住它原本的樣子，**交易提交時自動把改過的欄位寫回資料庫**（dirty checking）。

- 方便，但也危險：不小心改了一個欄位（例如為了顯示而格式化），就被存回去了
- 交易外面讀出來的 Entity 是「脫離的」（detached），改了不會自動存

## 6. 延遲載入與 N+1 問題（面試必考）

```java
List<Order> orders = orderRepository.findAll();          // 1 次查詢：SELECT * FROM orders
for (Order o : orders) {
    o.getItems().size();                                 // 每個 order 各 1 次：SELECT * FROM order_item WHERE order_id = ?
}
// 100 張訂單 = 1 + 100 次查詢 → N+1 問題
```

`@OneToMany` 預設是 **LAZY**（用到才查），`@ManyToOne` 預設是 **EAGER**（一起查，建議改成 LAZY）。

### 解法

```java
// ① JOIN FETCH：一次查回來
@Query("select distinct o from Order o left join fetch o.items where o.status = :status")
List<Order> findWithItems(@Param("status") OrderStatus status);

// ② EntityGraph
@EntityGraph(attributePaths = "items")
List<Order> findByStatus(OrderStatus status);

// ③ 批次載入：一次用 IN 查一批
// spring.jpa.properties.hibernate.default_batch_fetch_size=100
```

> 30 Lab 用 MongoDB 也遇到同樣的問題：排行榜要 20 個人的暱稱，如果迴圈裡一個一個查就是 N+1。解法是先收集所有 id，`findAllById` 一次查回來（[專案教程第 12 章](../backend/12-aggregation.md)）。

### `LazyInitializationException`

```java
Order order = service.findOrder(id);   // Service 的交易已經結束
order.getItems().size();               // 💥 could not initialize proxy - no Session
```

延遲載入需要交易（資料庫 session）還開著。`spring.jpa.open-in-view=true`（預設）會讓 session 一直開到 HTTP 回應結束，把這個錯誤「藏起來」，但代價是 Controller 裡也會偷偷查資料庫、連線占用更久。**建議關掉，在 Service 裡把需要的資料都準備好、轉成 DTO 再回傳**。

## 7. 資料庫遷移：Flyway

正式環境不能讓 Hibernate 自動改資料表。用遷移工具管理（≈ Prisma Migrate、TypeORM migration、Knex migration）：

```
src/main/resources/db/migration/
├── V1__create_orders.sql
├── V2__add_status_index.sql
└── V3__add_version_column.sql
```

```sql
-- V1__create_orders.sql
CREATE TABLE orders (
    id BIGSERIAL PRIMARY KEY,
    customer_name VARCHAR(64) NOT NULL,
    status VARCHAR(20) NOT NULL,
    total_cents BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

加 `flyway-core`（PostgreSQL 再加 `flyway-database-postgresql`）依賴後，Spring Boot 啟動時自動執行還沒跑過的遷移，記錄在 `flyway_schema_history` 表。**已經執行過的檔案不能再改**，要改就新增一個版本。

另一個選擇是 Liquibase。MongoDB 這邊對應的工具是 Mongock（30 Lab 用 `@Indexed` 自動建索引 + `ApplicationRunner` 補資料，規模小時夠用）。

## 8. `@Transactional` 完整解析

### 基本

```java
@Service
public class TransferService {
    @Transactional
    public void transfer(long from, long to, long amount) {
        accountRepository.debit(from, amount);
        accountRepository.credit(to, amount);      // 這裡丟例外 → 上面的 debit 也回滾
    }
}
```

### ⚠️ 預設只有 unchecked 例外才回滾

```java
@Transactional
public void importFile(Path path) throws IOException {
    repository.save(a);
    Files.readString(path);           // 丟 IOException（checked）
    // → 交易照樣**提交**！a 已經存進去了
}

@Transactional(rollbackFor = Exception.class)     // 要讓 checked 例外也回滾
```

這是 Java EE 時代留下來的慣例（checked 例外被視為「可預期的業務情況」）。**自訂例外繼承 `RuntimeException`** 就不會踩到。

### 例外被吞掉也不會回滾

```java
@Transactional
public void process() {
    try {
        repository.save(a);
        riskyCall();
    } catch (Exception e) {
        log.error("失敗", e);          // 沒有再丟出 → Spring 不知道出錯了 → 提交
    }
}
```

### 傳播行為（propagation）：交易裡呼叫另一個交易方法

| 傳播 | 已經有交易時 | 沒有交易時 | 用途 |
|---|---|---|---|
| **`REQUIRED`**（預設） | 加入 | 開新的 | 幾乎所有情況 |
| `REQUIRES_NEW` | **暫停外面的，開一個獨立的** | 開新的 | 不管外面成功失敗都要記錄（稽核日誌） |
| `NESTED` | 在外面的交易裡建立儲存點 | 開新的 | 部分回滾 |
| `SUPPORTS` | 加入 | 不用交易 | |
| `MANDATORY` | 加入 | **丟例外** | 確保一定在交易裡被呼叫 |
| `NOT_SUPPORTED` | 暫停外面的 | 不用交易 | |
| `NEVER` | **丟例外** | 不用交易 | |

> 30 Lab 的下注：`transactionTemplate.execute` 開交易，裡面呼叫的 `walletService.debit` 也有 `@Transactional`（`REQUIRED`），所以**加入**外面的交易，三個寫入一起成功或失敗。

> ⚠️ 內層 `REQUIRED` 的方法丟了例外，就算外層 catch 住了，整個交易也已經被標記成「只能回滾」，外層提交時會丟 `UnexpectedRollbackException`。

### 隔離等級（isolation）

| 等級 | 防止 | 說明 |
|---|---|---|
| `READ_UNCOMMITTED` | — | 讀得到別人還沒提交的資料（髒讀） |
| `READ_COMMITTED` | 髒讀 | **PostgreSQL 的預設** |
| `REPEATABLE_READ` | + 不可重複讀 | MySQL InnoDB 的預設 |
| `SERIALIZABLE` | + 幻讀 | 最嚴格、最慢 |

```java
@Transactional(isolation = Isolation.SERIALIZABLE)
```

一般用預設就好；需要更強的保證時，通常用下面的「鎖」解決特定的問題，而不是調高整體的隔離等級。

### 其他屬性

```java
@Transactional(readOnly = true)     // 唯讀：Hibernate 不做髒檢查，資料庫可能做優化
@Transactional(timeout = 5)         // 秒
```

常見寫法：class 上加 `@Transactional(readOnly = true)`，寫入的方法再加 `@Transactional` 覆蓋。

### 什麼時候 `@Transactional` 不會生效

| 原因 | 說明 |
|---|---|
| 同一個 class 自己呼叫 | 沒經過代理（[S2](11-ioc-aop.md)） |
| 方法是 `private` / `final` | 代理碰不到 |
| 丟的是 checked 例外 | 預設不回滾 |
| 例外被 catch 掉 | Spring 不知道出錯 |
| 物件是自己 `new` 的 | 不是 Spring 管理的 Bean，沒有代理 |
| 資料庫不支援交易 | MongoDB 單機版（30 Lab 用副本集就是為了這個） |

## 9. 並發控制：鎖

兩個請求同時改同一筆資料：

### 樂觀鎖：假設很少衝突，衝突時才處理

```java
@Version private long version;
```

每次 UPDATE 會帶 `WHERE id = ? AND version = ?`，並把 version + 1。別人先改了 → 0 筆被更新 → 丟 `OptimisticLockingFailureException` → 重試或告訴使用者。

### 悲觀鎖：先鎖住再改

```java
@Lock(LockModeType.PESSIMISTIC_WRITE)                 // SELECT ... FOR UPDATE
@Query("select a from Account a where a.id = :id")
Optional<Account> findForUpdate(@Param("id") long id);
```

### 條件更新：最簡單、最常用

```sql
UPDATE accounts SET balance = balance - 100 WHERE id = 1 AND balance >= 100;   -- 回傳 0 筆 = 餘額不足
```

**30 Lab 全部用這種**（MongoDB 的 `findAndModify` + 條件），不需要讀出來再寫回，自然不會有並發問題。

| 方法 | 適合 |
|---|---|
| 條件更新 | 單一欄位的增減、狀態轉換 |
| 樂觀鎖 | 衝突少、一次改很多欄位（編輯表單） |
| 悲觀鎖 | 衝突多、必須保證順序（搶票） |

## 10. JdbcClient：直接寫 SQL

不想用 ORM 時（報表、複雜查詢），Spring 6.1+ 的 `JdbcClient`：

```java
List<OrderSummary> list = jdbcClient.sql("""
        select id, customer_name, total_cents from orders
        where status = :status and created_at >= :from
        """)
        .param("status", "PAID")
        .param("from", Timestamp.from(from))
        .query(OrderSummary.class)                 // 自動對應到 record（欄位名稱 snake_case → camelCase）
        .list();
```

---

## 面試常問

- **JPA、Hibernate、Spring Data JPA 的關係？** JPA 是規格；Hibernate 是最常用的實作；Spring Data JPA 在上面加了 Repository 抽象
- **什麼是 N+1 問題？怎麼解決？** 見第 6 節：JOIN FETCH、EntityGraph、批次載入
- **LAZY 和 EAGER 的差別？** 用到才查 vs 一起查；建議全部用 LAZY，需要時再 fetch
- **`@Transactional` 的傳播行為？** 見第 8 節，重點是 REQUIRED 和 REQUIRES_NEW
- **`@Transactional` 什麼時候會失效？** 見第 8 節的表
- **樂觀鎖和悲觀鎖的差別？** 見第 9 節
- **為什麼正式環境不用 `ddl-auto=update`？** 不會刪欄位、不能控制順序、不能做資料遷移、無法回溯；用 Flyway 有版本記錄
- **事務的 ACID？** 原子性（全部成功或全部失敗）、一致性（約束不被破壞）、隔離性（交易之間互不干擾）、持久性（提交後不會遺失）

## 小練習

1. 用 Docker 開一個 PostgreSQL，另外建一個小 Spring Boot 專案（start.spring.io 選 Web、Data JPA、PostgreSQL、Lombok），做一個 `Order` + `OrderItem` 的 CRUD
2. 開 `spring.jpa.show-sql=true`，重現第 6 節的 N+1，再用 `join fetch` 修好，比較 SQL 的數量
3. 寫一個 `@Transactional` 方法丟 `IOException`，確認資料真的被提交了；加上 `rollbackFor` 再試一次

上一章：[S3 Web 開發深入](12-web-mvc.md)　下一章：[S5 測試](14-testing.md)
