# 07 登入：Spring Security、JWT、Redis session

## 1. 要解決什麼問題

HTTP 本身**不記得你是誰**，每個請求都是獨立的。登入後，後端要能從每個請求認出「這是 rain_01」。另外這個專案還有一條規則：

> **同一個帳號只能有一個登入**。在手機登入，電腦上的登入就失效（後登入的踢掉前一個）。

## 2. 整體設計

| 東西 | 放哪裡 | 內容 | 作用 |
|---|---|---|---|
| JWT | 瀏覽器的 **HttpOnly cookie** `tl_token` | `sub` = userId、`jti` = sessionId、到期時間、簽名 | 證明「後端發給你的，沒被改過」 |
| 目前有效的 session | **Redis** `session:{userId}` | sessionId | 判斷「這個 JWT 是不是最新的那次登入」 |

**為什麼 JWT 還不夠，還要 Redis？** JWT 一旦發出去，在到期前都是有效的，後端沒辦法「收回」。單靠 JWT 做不到「後登入的踢掉前一個」。所以每次登入產生一個新的 sessionId，寫進 Redis；檢查時比對 JWT 裡的 sessionId 跟 Redis 裡的是不是同一個。

```
第一次登入（電腦）  → Redis: session:u1 = s1   電腦的 JWT 帶 s1 ✅
第二次登入（手機）  → Redis: session:u1 = s2   手機的 JWT 帶 s2 ✅
電腦再打 API       → JWT 帶 s1，Redis 是 s2 → 不一樣 → 40102「帳號已在其他地方登入」
```

## 3. Filter：每個請求都會經過的關卡

**Filter ≈ Express 的 middleware**：在請求到 Controller 之前先執行，可以讀請求、設定東西、或直接擋掉。

```js
// Express 的 middleware
app.use((req, res, next) => {
  const token = req.cookies.tl_token
  if (token) req.user = verify(token)
  next()                                   // 交給下一個
})
```

Spring Security 是**一串 filter**（Security Filter Chain），我們在裡面插入自己的 `JwtCookieFilter`。

## 4. `SecurityConfig`：安全規則

```java
// config/SecurityConfig.java
@Configuration
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            JwtService jwtService,
            SessionService sessionService,
            AuthProperties authProperties,
            @Qualifier("handlerExceptionResolver") HandlerExceptionResolver resolver) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)                                         // ①
                .anonymous(AbstractHttpConfigurer::disable)                                    // ②
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS)) // ③
                .authorizeHttpRequests(auth -> auth                                            // ④
                        .requestMatchers("/api/auth/register", "/api/auth/login", "/api/auth/logout").permitAll()
                        .requestMatchers("/swagger-ui.html", "/swagger-ui/**", "/v3/api-docs/**").permitAll()
                        .requestMatchers("/actuator/health", "/error", "/ws").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/draws/**", "/api/jackpot", "/api/leaderboard/**", "/api/game/rules").permitAll()
                        .anyRequest().authenticated())                                         // ⑤
                .exceptionHandling(e -> e                                                      // ⑥
                        .authenticationEntryPoint((req, res, ex) ->
                                resolver.resolveException(req, res, null, new BusinessException(authErrorOf(req))))
                        .accessDeniedHandler((req, res, ex) ->
                                resolver.resolveException(req, res, null, new BusinessException(ErrorCode.FORBIDDEN))))
                .addFilterBefore(                                                              // ⑦
                        new JwtCookieFilter(jwtService, sessionService, authProperties.cookieName()),
                        UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    private static ErrorCode authErrorOf(HttpServletRequest request) {
        return request.getAttribute(JwtCookieFilter.AUTH_ERROR_ATTR) instanceof ErrorCode code ? code : ErrorCode.UNAUTHORIZED;
    }
}
```

| 編號 | 意思 | 為什麼 |
|---|---|---|
| ① | 關掉 Spring 內建的 CSRF token 檢查 | Cookie 設了 `SameSite=Lax`，別的網站發起的 `POST` 不會帶上我們的 cookie；而且寫入 API 都是 `POST` + JSON |
| ② | 關掉「匿名使用者」 | 沒登入時 `@AuthenticationPrincipal` 拿到的是 `null`，而不是一個叫 `anonymousUser` 的字串 |
| ③ | `STATELESS`：Spring 不建立自己的 session | 我們用 JWT + Redis，不需要 Spring 的 `JSESSIONID` |
| ④ | **不用登入**的路徑（`permitAll`） | 註冊、登入、Swagger、健康檢查、WebSocket 握手、公開的 GET API |
| ⑤ | 其他所有路徑都**要登入** | 預設安全：新增的 API 忘了設定，會被擋住而不是被公開 |
| ⑥ | 沒登入 / 沒權限時怎麼回應 | 轉成 `BusinessException`，交給 `GlobalExceptionHandler`，格式跟其他錯誤一樣 |
| ⑦ | 把 `JwtCookieFilter` 插進 filter 鏈 | 放在 Spring 內建的帳密登入 filter 之前 |

> ⚠️ **新增一支不用登入的 API，一定要加到 ④**。這個專案漏過兩次（`/api/game/rules`、`/api/leaderboard/balance`），症狀是：不登入打就回 `40100`。
> `"/api/leaderboard/**"` 的 `**` 代表底下所有路徑，`"/api/leaderboard"` 只代表那一個。

### ⑥ 為什麼要轉一手？

Security 的檢查發生在 **Controller 之前**，那時候 `@RestControllerAdvice` 還管不到。`resolver.resolveException(...)` 是把例外**交給 Spring MVC 的錯誤處理機制**，也就是 `GlobalExceptionHandler`。這樣沒登入的回應也是 `{ code: 40100, msg, data }`，前端不用處理兩種格式。

`authErrorOf`：如果 `JwtCookieFilter` 發現是「被踢掉」，會在請求上記下 `SESSION_REPLACED`，這裡就回 `40102`；否則一律 `40100`。

## 5. `JwtCookieFilter`：認出你是誰

```java
// account/security/JwtCookieFilter.java
@RequiredArgsConstructor
public class JwtCookieFilter extends OncePerRequestFilter {     // 每個請求只執行一次的 filter
    public static final String AUTH_ERROR_ATTR = "authError";
    public static final String SESSION_ID_ATTR = "sessionId";

    private final JwtService jwtService;
    private final SessionService sessionService;
    private final String cookieName;                            // "tl_token"

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Cookie cookie = WebUtils.getCookie(request, cookieName);   // ① 讀 cookie
        if (cookie != null) {
            authenticate(request, cookie.getValue());
        }
        chain.doFilter(request, response);                         // ② 不管認不認得，都交給下一個 filter
    }

    private void authenticate(HttpServletRequest request, String token) {
        Claims claims;
        try {
            claims = jwtService.parse(token);                      // ③ 驗證簽名、檢查到期
        } catch (JwtException | IllegalArgumentException e) {
            return;                                                //    被竄改、過期 → 當作沒登入
        }

        String userId = claims.getSubject();
        String current = sessionService.current(userId);           // ④ 查 Redis：這個帳號目前有效的 sessionId
        if (current == null) {
            return;                                                //    已登出 / 過期 → 當作沒登入
        }
        if (!current.equals(claims.getId())) {                     // ⑤ JWT 的 sessionId 跟 Redis 不一樣
            request.setAttribute(AUTH_ERROR_ATTR, ErrorCode.SESSION_REPLACED);   // 記下「被踢掉了」
            return;
        }

        var auth = new UsernamePasswordAuthenticationToken(userId, null, List.of());
        SecurityContextHolder.getContext().setAuthentication(auth);   // ⑥ 告訴 Spring：這個請求是 userId
        request.setAttribute(SESSION_ID_ATTR, current);               //    WebSocket 握手會用到（第 13 章）
    }
}
```

**重點：這個 filter 從不直接回錯誤**。它只負責「認得就設定使用者，不認得就什麼都不做」。要不要擋，交給 ④ 的規則決定：

- 公開的 API（例如 `GET /api/draws/current`）：沒登入也放行，Controller 拿到的 `userId` 是 `null`
- 要登入的 API：Security 發現沒有設定使用者 → 觸發 ⑥ → `40100` 或 `40102`

⑥ 的 `UsernamePasswordAuthenticationToken(userId, null, List.of())`：第一個參數是「主體」（principal），**這就是 Controller 裡 `@AuthenticationPrincipal String userId` 拿到的值**。第二個是密碼（不需要），第三個是權限列表（這個專案沒有角色）。

`SecurityContextHolder` ≈ Express 的 `req.user`，但它是「綁在目前這條執行緒」的，所以同一個請求後面的程式都拿得到。

## 6. `JwtService`：產生和驗證 JWT

JWT 是三段用 `.` 連起來的字串：`header.payload.signature`。

```
eyJhbGciOiJIUzI1NiJ9 . eyJzdWIiOiI2YWRiLi4uIiwianRpIjoiMTFkZS4uLiIsImlhdCI6MTc5Mi4uLiwiZXhwIjoxNzkzLi4ufQ . EteII-k_Dalk...
      header                                    payload（base64，任何人都能解開看）                                簽名
```

payload 解開是：`{ "sub": "6adb...", "jti": "11de...", "iat": 1792744065, "exp": 1793348865 }`。

> payload **不是加密的**，任何人都看得到內容，所以**不能放密碼或敏感資料**。簽名的作用是「改了內容，簽名就對不上」，所以別人無法偽造。

```java
// account/service/JwtService.java
@Service
public class JwtService {
    private final SecretKey key;
    private final Duration ttl;

    public JwtService(AuthProperties props) {
        this.key = Keys.hmacShaKeyFor(props.jwtSecret().getBytes(StandardCharsets.UTF_8));   // 密鑰（至少 32 bytes）
        this.ttl = props.tokenTtl();                                                          // 7 天
    }

    public String issue(String userId, String sessionId) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(userId)                       // sub：這個 token 屬於誰
                .id(sessionId)                         // jti：這次登入的 sessionId
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(ttl)))
                .signWith(key)                         // 用密鑰簽名（HS256）
                .compact();
    }

    public Claims parse(String token) {
        return Jwts.parser()
                .verifyWith(key)                       // 簽名不對、過期 → 丟 JwtException
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
```

≈ Node 的 `jwt.sign({ sub, jti }, secret, { expiresIn: '7d' })` / `jwt.verify(token, secret)`。

**密鑰 `JWT_SECRET` 絕對不能外洩**：有了它，任何人都能簽出「我是 admin」的 JWT。本機用設定檔裡的預設值，上線由 Render 自動產生。

## 7. `SessionService`：Redis 裡的「目前有效登入」

```java
// account/service/SessionService.java
@Service
@RequiredArgsConstructor
public class SessionService {
    private final StringRedisTemplate redis;
    private final AuthProperties authProperties;

    public record NewSession(String sessionId, String replacedSessionId) {}

    public NewSession create(String userId) {
        String sessionId = UUID.randomUUID().toString();
        String previous = redis.opsForValue().setGet(key(userId), sessionId, authProperties.tokenTtl());
        return new NewSession(sessionId, previous);
    }

    public String current(String userId) {
        return redis.opsForValue().get(key(userId));
    }

    public void remove(String userId) {
        redis.delete(key(userId));
    }

    private static String key(String userId) {
        return "session:" + userId;
    }
}
```

`setGet` 對應 Redis 的 `SET session:u1 s2 EX 604800 GET`：**寫入新值，同時拿回舊值，而且是一個原子操作**。

為什麼要原子？如果分成「先 GET 再 SET」兩步，兩個裝置同時登入時可能都拿到同一個舊值，誰被踢掉就會算錯。原子操作保證每次登入都準確拿到「被自己取代的那一個」。

`EX 604800`（7 天）：跟 JWT 同時過期，Redis 不會無限累積舊資料。

## 8. 註冊和登入

### `AuthService`

```java
// account/service/AuthService.java
public LoginResult register(RegisterRequest req) {
    if (userRepository.existsUserByUsername(req.username())) {           // ① 先查一次
        throw new BusinessException(ErrorCode.USERNAME_TAKEN);
    }
    User user = new User();
    user.setUsername(req.username());
    user.setNickname(req.nickname());
    user.setPasswordHash(passwordEncoder.encode(req.password()));       // ② 密碼只存雜湊

    User saved;
    try {
        saved = userRepository.save(user);
    } catch (DuplicateKeyException e) {                                  // ③ 兩個人同時註冊同一個帳號
        throw new BusinessException(ErrorCode.USERNAME_TAKEN);
    }
    walletService.getOrOpen(saved.getId());                              // ④ 開錢包、送 10,000
    return startSession(saved);                                          // ⑤ 註冊完直接登入
}

public LoginResult login(LoginRequest req) {
    User user = userRepository.findUserByUsername(req.username())
            .filter(u -> passwordEncoder.matches(req.password(), u.getPasswordHash()))
            .orElseThrow(() -> new BusinessException(ErrorCode.BAD_CREDENTIALS));   // 帳號不存在、密碼錯都是 40101
    return startSession(user);
}

private LoginResult startSession(User user) {
    SessionService.NewSession session = sessionService.create(user.getId());      // 新 sessionId 寫進 Redis
    if (session.replacedSessionId() != null) {                                   // 有被取代的舊登入
        messagingTemplate.convertAndSendToUser(
                session.replacedSessionId(), "/queue/session", new SessionEvent("SESSION_REPLACED"));   // 即時通知舊裝置
    }
    String token = jwtService.issue(user.getId(), session.sessionId());
    return new LoginResult(UserResponse.from(user), token);
}
```

- ① 和 ③ 為什麼都要？① 是一般情況的快速檢查；③ 是**兩個請求同時通過 ① 的情況**，靠 `username` 的唯一索引擋下第二個（第 9 章會一直看到這個模式）
- ② **BCrypt** 雜湊：同一個密碼每次雜湊結果都不一樣（有隨機 salt），而且故意算得很慢，資料庫外洩也很難反推密碼。`passwordEncoder.matches` 負責比對
- 帳號不存在和密碼錯誤回**同一個錯誤**：不讓別人用登入試出哪些帳號存在

### `AuthController`：設定 cookie

```java
// account/controller/AuthController.java
@PostMapping("/login")
public ResponseEntity<Result<UserResponse>> login(@Valid @RequestBody LoginRequest req) {
    AuthService.LoginResult result = authService.login(req);
    return withCookie(result.token(), authProperties.tokenTtl()).body(Result.ok(result.user()));
}

@PostMapping("/logout")
public ResponseEntity<Result<Void>> logout(@AuthenticationPrincipal String userId) {
    if (userId != null) {
        authService.logout(userId);                      // 刪掉 Redis 的 session
    }
    return withCookie("", Duration.ZERO).body(Result.ok());   // maxAge 0 = 叫瀏覽器刪掉 cookie
}

private ResponseEntity.BodyBuilder withCookie(String value, Duration maxAge) {
    ResponseCookie cookie = ResponseCookie.from(authProperties.cookieName(), value)   // tl_token
            .httpOnly(true)                             // JS 讀不到
            .secure(authProperties.cookieSecure())      // 上線（https）是 true
            .sameSite("Lax")                            // 別的網站發的 POST 不會帶這個 cookie
            .path("/")
            .maxAge(maxAge)                             // 7 天
            .build();
    return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, cookie.toString());
}
```

`ResponseEntity`：需要設定 HTTP header 或狀態碼時，Controller 回傳它而不是直接回 `Result`。

### Cookie 的屬性

| 屬性 | 作用 | 擋什麼 |
|---|---|---|
| `HttpOnly` | 前端 JS（`document.cookie`）讀不到 | **XSS**：就算網頁被注入惡意 JS，也偷不到 token |
| `SameSite=Lax` | 從別的網站發起的 `POST` 不帶這個 cookie | **CSRF**：惡意網站偷偷幫你下注 |
| `Secure` | 只在 https 傳送 | 被竊聽。本機是 http，所以只在上線時開 |

**跟把 token 放 localStorage 比**：localStorage 的 token JS 讀得到，XSS 就能偷走；而且每個請求要自己加 `Authorization` header。HttpOnly cookie 瀏覽器會自動帶，前端完全不用碰 token。

## 9. 完整流程：被踢下線

1. 電腦登入 → Redis `session:u1 = s1`，電腦拿到 JWT（`jti = s1`）
2. 電腦的 WebSocket 連線時，握手記錄「這條連線屬於 session `s1`」（第 13 章）
3. 手機登入 → `setGet` 寫入 `s2`、拿回 `s1`
4. `startSession` 發現有舊的 `s1` → WebSocket 推 `SESSION_REPLACED` 給 `s1` 那條連線 → 電腦的畫面立刻導回登入頁
5. 就算電腦沒開 WebSocket，下次打 API 時：`JwtCookieFilter` 看到 JWT 是 `s1`、Redis 是 `s2` → 記下 `SESSION_REPLACED` → 要登入的 API 回 `40102`

> 上線後的限制（`docs/deploy.md`）：cookie 在 Vercel 的網域，WebSocket 連 Render 的網域，握手時瀏覽器不會帶 cookie，所以第 4 步的即時通知會失效，只剩第 5 步。

---

## 小練習

1. 登入後在瀏覽器 DevTools → Application → Cookies 找到 `tl_token`，確認勾了 HttpOnly。在 Console 打 `document.cookie`，看得到它嗎？
2. 把 `tl_token` 的值貼到 https://jwt.io ，看看 payload 裡有什麼。`sub` 是誰的 id？
3. 用 Docker 看 Redis：`docker exec tl-redis redis-cli keys "session:*"`，再 `get` 其中一個，跟 JWT 的 `jti` 比對。
4. 用兩個不同的瀏覽器（或一般 + 無痕視窗）登入同一個帳號，觀察先登入的那個發生什麼事。
5. `GET /api/leaderboard` 不用登入，但登入後會多回傳 `mine`（自己的名次）。Controller 是怎麼知道有沒有登入的？

上一章：[06 驗證與錯誤處理](06-validation-errors.md)　下一章：[08 MongoDB](08-mongodb.md)
