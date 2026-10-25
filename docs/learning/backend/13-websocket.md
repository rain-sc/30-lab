# 13 WebSocket 推播

## 1. 要解決什麼問題

開獎時，所有開著網頁的人要**同一時間**看到開獎動畫。如果靠前端每秒問一次 `GET /api/draws/current`（輪詢），1000 個人就是每秒 1000 個請求，而且最多會晚 1 秒。

**WebSocket**：瀏覽器和伺服器之間建立一條一直開著的連線，**伺服器有事就主動推給瀏覽器**。

| | HTTP | WebSocket |
|---|---|---|
| 誰先開口 | 只能瀏覽器問、伺服器答 | 連線後雙方都可以主動送 |
| 連線 | 每個請求一次 | 一直開著 |
| 適合 | 一般的 API | 即時通知、聊天 |

## 2. STOMP：WebSocket 上的「頻道」

WebSocket 只是一條傳送文字的管道，沒有「頻道」「訂閱」的概念。**STOMP** 是一個在 WebSocket 上面的協定，加上了訂閱 / 發布：

```
瀏覽器                              伺服器
  │── CONNECT ───────────────────────▶│
  │── SUBSCRIBE /topic/draws ────────▶│   「我要收開獎的消息」
  │── SUBSCRIBE /user/queue/session ─▶│   「我要收給我自己的消息」
  │                                   │
  │◀── MESSAGE /topic/draws ──────────│   伺服器推：{ type: "DRAWN", ... }
```

≈ socket.io 的 `socket.on('draws', ...)` / room。NestJS 的 `@WebSocketGateway` 預設用 socket.io；Spring 預設用 STOMP。

## 3. 這個專案的頻道

| 目的地 | 誰收得到 | 內容 | 前端要做什麼 |
|---|---|---|---|
| `/topic/draws` | **所有**連線的人（不用登入） | `OPENED`、`CLOSED`、`DRAWN`、`SETTLED` + 期數資料 | 更新倒數、播開獎動畫、更新結果 |
| `/user/queue/session` | **特定的一個登入** | `SESSION_REPLACED` | 被別處登入踢掉，導回登入頁 |

- `/topic/...`：廣播，每個訂閱的人都收到
- `/user/...`：只送給特定的使用者

## 4. 後端設定

```java
// config/WebSocketConfig.java
@Configuration
@EnableWebSocketMessageBroker                                   // 開啟 STOMP
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final String[] allowedOrigins;
    private final TaskScheduler heartbeatScheduler;

    public WebSocketConfig(
            @Value("${app.cors.allowed-origins}") String[] allowedOrigins,      // 允許哪些前端網址連線
            @Lazy @Qualifier("messageBrokerTaskScheduler") TaskScheduler heartbeatScheduler) {
        this.allowedOrigins = allowedOrigins;
        this.heartbeatScheduler = heartbeatScheduler;
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")                              // ① 連線網址：ws://localhost:8088/ws
                .setHandshakeHandler(new SessionHandshakeHandler())   // ② 握手時記下這條連線屬於哪個登入
                .setAllowedOrigins(allowedOrigins);              // ③ 只允許自己的前端
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic", "/queue")          // ④ 記憶體內的簡單 broker
                .setHeartbeatValue(new long[] {10_000, 10_000})  // ⑤ 每 10 秒互相確認對方還活著
                .setTaskScheduler(heartbeatScheduler);
        registry.setApplicationDestinationPrefixes("/app");      // 前端送訊息給後端用的前綴（這個專案沒用到）
        registry.setUserDestinationPrefix("/user");              // ⑥ 「送給特定使用者」的前綴
    }
}
```

| 編號 | 說明 |
|---|---|
| ① | 前端連 `ws://localhost:8088/ws`，**直連後端，不經過 Next.js**（專案約定，見根目錄 `CLAUDE.md`：長時間開著的連線不適合透過 Next.js 轉發） |
| ② | 見第 6 節 |
| ③ | 瀏覽器連 WebSocket 時會帶 `Origin` header。只允許 `app.cors.allowed-origins` 裡的網址，防止別的網站偷連。**上線時要設成 Vercel 的網址** |
| ④ | Broker = 負責把訊息分送給訂閱者的元件。`SimpleBroker` 存在記憶體裡 |
| ⑤ | 心跳：網路斷了雙方能在 10 幾秒內發現，前端就能重連 |
| ⑥ | 後端送 `convertAndSendToUser(x, "/queue/session", ...)`，實際目的地是 `/user/queue/session`，只給 x |

`/ws` 也要在 `SecurityConfig` 的 `permitAll` 裡，不然握手就被擋了。

## 5. 推播：一行程式

```java
// draw/scheduler/DrawTicker.java
messagingTemplate.convertAndSend("/topic/draws", new DrawEvent(type, now, DrawResponse.from(draw)));
```

- `SimpMessagingTemplate`：Spring 提供的 Bean，注入就能用
- `convertAndSend`：把物件用 Jackson 轉成 JSON，送到這個目的地的所有訂閱者

```java
// draw/dto/DrawEvent.java
public record DrawEvent(Type type, Instant serverTime, DrawResponse draw) {
    public enum Type { OPENED, CLOSED, DRAWN, SETTLED }
}
```

前端收到：

```json
{ "type": "SETTLED", "serverTime": "2026-10-23T03:30:01.045Z",
  "draw": { "drawNo": "20261023-0042", "status": "SETTLED", "numbers": [...], "poolAmount": 500198, "prizeSummary": {...} } }
```

- `serverTime`：前端用來校正自己的時鐘（倒數計時要準）
- 後端停機後重啟，可能**一次補送好幾期**的事件，前端要用 `drawNo` 判斷是哪一期

## 6. 推給特定的人：被踢下線通知

### 握手時記下「這條連線是哪個登入」

```java
// account/security/SessionHandshakeHandler.java
public class SessionHandshakeHandler extends DefaultHandshakeHandler {
    @Override
    protected Principal determineUser(ServerHttpRequest request, WebSocketHandler wsHandler,
                                      Map<String, Object> attributes) {
        if (request instanceof ServletServerHttpRequest servletRequest
                && servletRequest.getServletRequest().getAttribute(JwtCookieFilter.SESSION_ID_ATTR) instanceof String sessionId) {
            return new SessionPrincipal(sessionId);      // 這條連線的「使用者名稱」= sessionId
        }
        return null;                                     // 沒登入：匿名連線，只能收廣播
    }
}
```

1. WebSocket 握手其實是一個 HTTP 請求，**會帶 cookie**，所以也會經過 `JwtCookieFilter`（第 7 章）
2. `JwtCookieFilter` 驗證成功時，把 sessionId 存在請求的屬性 `SESSION_ID_ATTR`
3. `determineUser` 讀出這個 sessionId，當成這條 WebSocket 連線的「使用者」

**為什麼用 sessionId 而不是 userId？** 同一個帳號在新裝置登入後，要通知的是**舊的那個登入**。如果用 userId，新舊兩個裝置都是同一個 userId，會連新的也一起踢掉。

### 送出通知

```java
// account/service/AuthService.java 的 startSession()
if (session.replacedSessionId() != null) {
    messagingTemplate.convertAndSendToUser(
            session.replacedSessionId(), "/queue/session", new SessionEvent("SESSION_REPLACED"));
}
```

只有「使用者 = 舊 sessionId」的那條連線收得到。

## 7. 限制

| 限制 | 原因 | 要擴展時 |
|---|---|---|
| 多台伺服器時，A 機推的訊息，連在 B 機的人收不到 | `SimpleBroker` 存在**單一台機器的記憶體**裡 | 換成外部 broker（RabbitMQ、Redis Pub/Sub） |
| 上線後被踢下線的即時通知失效 | cookie 在 Vercel 的網域，WebSocket 連 Render 的網域，握手時不會帶 cookie | 前後端放在同一個父網域下（自己的網域） |

這也是 `backend/CLAUDE.md` 說「不用 ShedLock，多台部署真正的阻礙是 WebSocket」的原因：排程靠條件更新已經不怕多台，但推播還不行。

---

## 小練習

1. 開著遊戲頁面，在 DevTools → Network → 篩選 WS，點開 `/ws` 那條連線，看 Messages 分頁：找到 `SUBSCRIBE`、心跳（單獨的換行）、`MESSAGE` 的 `DRAWN`。
2. 把 `application.properties` 的 `app.cors.allowed-origins` 暫時改成別的網址，重啟後端，前端的 WebSocket 會怎樣？前端怎麼處理？（記得改回來）
3. 為什麼 `/topic/draws` 不用登入就能收？如果改成要登入，首頁的開獎動畫會怎樣？
4. 用你自己的話解釋：為什麼「被踢下線」要用 sessionId，而不是 userId？

上一章：[12 聚合管線](12-aggregation.md)　下一章：[14 測試](14-testing.md)
