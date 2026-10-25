# 04 設定檔與環境

## 1. 要解決什麼問題

很多值不應該寫死在程式裡：

| 值 | 為什麼不能寫死 |
|---|---|
| 資料庫位址 | 本機是 `localhost:27018`，上線是 Atlas |
| JWT 密鑰 | 絕對不能進 Git |
| 每期幾分鐘、獎金多少 | 想調整遊戲平衡時，不想改程式 |
| 號碼範圍 1~30 | 從 49 改成 30 時，只改一行設定 |

前端用 `.env` + `process.env.XXX`；NestJS 用 `ConfigModule` + `configService.get('XXX')`。Spring 用 **`application.properties`** + **`@ConfigurationProperties`**。

## 2. `application.properties`

位置：`backend/src/main/resources/application.properties`。格式是一行一個 `key=value`：

```properties
# ===== 遊戲規則 =====
app.game.draw-interval=5m          # 每 5 分鐘一期（Spring 自動把 5m 轉成 Duration）
app.game.betting-cutoff=15s        # 開獎前 15 秒停止下注
app.game.points-per-bet=10         # 每注 10 積分
app.game.max-number=30             # 號碼 1~30

# ===== 獎金 =====
app.prize.jackpot-floor=500000
app.prize.jackpot-rate-percent=20
app.prize.second=56000
...
```

- `spring.*`、`server.*`、`management.*` 開頭的是 **Spring 自己認得的設定**（資料庫連線、埠號、actuator）
- `app.*` 開頭的是**我們自己定義的**，要配合 `@ConfigurationProperties` 才會被讀進程式

### 環境變數優先、冒號後面是預設值

```properties
server.port=${PORT:${SERVER_PORT:8088}}
spring.mongodb.uri=${MONGODB_URI:mongodb://localhost:27018/thirtylab?directConnection=true}
app.auth.jwt-secret=${JWT_SECRET:dev-only-secret-please-change-me-0123456789}
app.auth.cookie-secure=${COOKIE_SECURE:false}
```

`${MONGODB_URI:預設值}` 的意思：**有環境變數 `MONGODB_URI` 就用它，沒有就用冒號後面的值**。

≈ JavaScript 的 `process.env.MONGODB_URI ?? 'mongodb://localhost:27018/...'`。

所以：
- **本機**什麼都不用設，全部用預設值
- **上線（Render）**在 Dashboard 設 `MONGODB_URI`、`JWT_SECRET` 等環境變數，就會蓋掉預設值，密碼不會進 Git

`server.port` 有兩層：Render 會給 `PORT`，本機可以用 `SERVER_PORT` 改（副本就是用 `SERVER_PORT=8099` 跑在 8099），都沒有就是 8088。

> ⚠️ **中文註解變成 `測試`？** 這是 IntelliJ 的「Transparent native-to-ascii conversion」：檔案裡存的是 `\uXXXX`，IntelliJ 顯示成中文。用 IntelliJ 編輯時正常打中文就好。如果打開看到 `???`，到 Settings → Editor → File Encodings，把 Properties Files 設成 UTF-8 並勾選 Transparent native-to-ascii conversion。

## 3. `@ConfigurationProperties`：把設定變成有型別的物件

### 寫法

```java
// config/GameProperties.java
@Validated
@ConfigurationProperties(prefix = "app.game")
public record GameProperties(
        Duration drawInterval,
        Duration bettingCutoff,
        long pointsPerBet,
        // 號碼範圍 1 ~ maxNumber；至少要 7 個（6 個正碼 + 1 個特別號碼）
        @Min(7) @Max(99) int maxNumber) {
}
```

Spring 啟動時：

1. 看到 `prefix = "app.game"`，去找所有 `app.game.` 開頭的設定
2. 把 `draw-interval`（kebab-case）對應到 `drawInterval`（camelCase）
3. 型別轉換：`5m` → `Duration.ofMinutes(5)`、`"10"` → `long 10`、`"30"` → `int 30`
4. 呼叫 record 的建構子 `new GameProperties(5分鐘, 15秒, 10, 30)`，存成 Bean
5. 有 `@Validated` 的話，檢查 `@Min` / `@Max`，不合法就**啟動失敗**

要讓 Spring 找到這些設定類別，主程式要加 `@ConfigurationPropertiesScan`（第 1 章看過了）。

### 使用

跟其他 Bean 一樣，在建構子注入：

```java
// draw/service/NumberGenerator.java
@Component
@RequiredArgsConstructor
public class NumberGenerator {

    private final GameProperties gameProperties;

    public DrawnNumbers draw() {
        int maxNumber = gameProperties.maxNumber();     // 30
        ...
    }
}
```

### 專案裡所有的設定類別

| 類別 | prefix | 內容 |
|---|---|---|
| `GameProperties` | `app.game` | 每期間隔、截止時間、每注積分、號碼範圍 |
| `PrizeProperties` | `app.prize` | 頭獎保底、彩池注入比例、二～七獎獎金 |
| `WalletProperties` | `app.wallet` | 註冊送多少、每日簽到送多少 |
| `BettingProperties` | `app.betting` | 一張注單最多幾注 |
| `AuthProperties` | `app.auth` | JWT 密鑰、登入有效期、cookie 名稱、cookie 要不要 Secure |

### 為什麼不直接 `@Value("${app.game.max-number}")`？

也可以，`WebSocketConfig` 就用了 `@Value("${app.cors.allowed-origins}")`。但 `@ConfigurationProperties`：

- **有型別**、IntelliJ 會自動完成
- 相關的設定**集中在一個 record**
- **單元測試**時直接 `new GameProperties(Duration.ofMinutes(5), Duration.ofSeconds(15), 10, 30)`，不用啟動 Spring

## 4. 設定少一行，程式照跑：這個專案真的發生過 ⚠️

改獎金時，不小心把 `app.prize.jackpot-rate-percent=20` 這一行刪掉了。結果：

- **沒有任何錯誤**，後端照常啟動
- `PrizeProperties` 的 `long jackpotRatePercent` 拿不到值，變成**預設值 0**
- 彩池注入比例變成 0%，**彩池永遠不會增加**
- 是 4 個結算測試失敗才發現的（預期 `1500010`，實際 `1500000`）

≈ NestJS 的 `configService.get<number>('X')` 拿到 `undefined`，後面一算變成 `NaN` 或 `0`。

**解法：啟動時就驗證設定**（fail fast）

```java
// config/PrizeProperties.java
// 沒設定的 long 會是 0，所以 @Min(1) 也能擋住漏寫的設定
@Validated
@ConfigurationProperties(prefix = "app.prize")
public record PrizeProperties(
        @Min(1) long jackpotFloor,
        @Min(1) @Max(100) long jackpotRatePercent,
        @Min(1) long second,
        ...
) { }
```

現在再漏寫一行（或寫成 0），後端會**直接啟動失敗**，並告訴你哪個設定有問題（這是實際跑出來的訊息）：

```
***************************
APPLICATION FAILED TO START
***************************

Description:

Binding to target com.thirtylab.config.PrizeProperties failed:

    Property: app.prize.jackpotRatePercent
    Value: "0"
    Origin: "app.prize.jackpot-rate-percent" from property source "commandLineArgs"
    Reason: must be greater than or equal to 1
```

`Origin` 告訴你這個值是從哪裡來的（這裡是啟動參數；寫在設定檔裡的話會顯示檔名和行號）。漏寫的話沒有 `Origin`，因為根本沒有來源。

≈ NestJS `ConfigModule.forRoot({ validationSchema: Joi.object({...}) })`。

**原則：錯誤越早爆越好**。啟動失敗你馬上會看到；數字默默算錯，可能要好幾天才有人發現。

## 5. Profile：不同環境用不同設定

### 什麼是 profile

`application-xxx.properties` 只有在**啟用 `xxx` 這個 profile** 時才會讀，而且會**蓋掉** `application.properties` 裡同名的設定。

| 檔案 | 什麼時候生效 | 用途 |
|---|---|---|
| `src/main/resources/application.properties` | 永遠 | 基本設定，本機開發用的預設值 |
| `src/main/resources/application-cloud.properties` | `SPRING_PROFILES_ACTIVE=cloud`（Render 上設定） | Upstash Redis 要走 TLS、要密碼；日誌從 DEBUG 降到 INFO |
| `src/test/resources/application-test.properties` | 測試類別加了 `@ActiveProfiles("test")` | 用測試資料庫、關掉排程、固定遊戲規則 |

≈ 前端的 `.env.development`、`.env.production`、`.env.test`。

### 測試的設定為什麼要固定遊戲規則

```properties
# src/test/resources/application-test.properties
spring.mongodb.uri=mongodb://localhost:27018/thirtylab_test?directConnection=true
app.scheduling.enabled=false

# 測試用固定的規則：測試裡的金額、號碼都是照這組算的，跟正式環境的遊戲平衡（application.properties）分開
app.game.max-number=49
app.prize.jackpot-floor=1000000
app.prize.jackpot-rate-percent=20
app.prize.second=500000
...
```

1. **`thirtylab_test`**：測試會清空資料，絕對不能用正式的 `thirtylab`
2. **`app.scheduling.enabled=false`**：不然測試跑的時候，排程每秒在背景開獎，會改到測試資料（第 3 章的條件式 Bean）
3. **固定獎金**：測試裡寫死了「四獎 9,600」「彩池應該是 1,500,010」。如果測試讀正式設定，每次調整遊戲平衡測試就壞一批。固定之後，**調平衡只改 `application.properties`，測試不受影響**

> ⚠️ **每個 `@SpringBootTest` 都要加 `@ActiveProfiles("test")`**。忘了加，那個測試就會用 `application.properties`，連到**正式資料庫**。這個專案真的發生過：一個測試沒加，啟動時的補算功能就在正式資料庫執行了。

### 怎麼啟用 profile

| 方式 | 寫法 |
|---|---|
| 環境變數 | `SPRING_PROFILES_ACTIVE=cloud`（Render 用這個） |
| 測試 | 類別上加 `@ActiveProfiles("test")` |
| IntelliJ | Run → Edit Configurations → Active profiles |

## 6. 不是 `app.*` 的重要設定

| 設定 | 意思 |
|---|---|
| `spring.application.name=30-lab-backend` | 日誌每一行會顯示 `[30-lab-backend]` |
| `spring.data.mongodb.auto-index-creation=true` | 啟動時依照 model 上的 `@Indexed`、`@CompoundIndex` 自動建索引 |
| `management.endpoints.web.exposure.include=health,info` | 開放 `/actuator/health` |
| `logging.level.com.thirtylab=DEBUG` | 我們自己的程式印出 DEBUG 等級的日誌 |
| `springdoc.swagger-ui.operations-sorter=method` | Swagger 頁面依 HTTP 方法排序 |

---

## 小練習

1. 不改檔案，讓後端跑在 8089：在 IntelliJ 的 Run Configuration 設環境變數 `SERVER_PORT=8089`，啟動後打開 http://localhost:8089/actuator/health。記得改回來。
2. 打開 `GET /api/game/rules`，找到 `drawIntervalSeconds: 300`。這個 300 是從哪一行設定、經過哪個 class 算出來的？（提示：`GameRulesService`）
3. 把 `app.game.max-number=30` 改成 `5` 再啟動，看看錯誤訊息長怎樣，為什麼最少要 7？看完改回來。
4. `application-cloud.properties` 裡寫了 `spring.data.redis.password=${REDIS_PASSWORD}`，**沒有冒號和預設值**。如果在 Render 忘了設 `REDIS_PASSWORD` 會怎樣？

上一章：[03 Spring 核心](03-spring-bean-di.md)　下一章：[05 第一支 API](05-first-api.md)
