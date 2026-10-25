# S6 安全與上線

## Part 1：Spring Security 的概念

[專案教程第 7 章](../backend/07-security-login.md) 講了 30 Lab 自訂的 JWT cookie 登入。這裡補上 Spring Security 一般的概念，看別的專案時才看得懂。

### 1. 認證與授權

| | 認證（Authentication） | 授權（Authorization） |
|---|---|---|
| 問題 | 你是誰？ | 你可以做這件事嗎？ |
| 失敗 | 401 Unauthorized | 403 Forbidden |
| 例子 | 帳號密碼、JWT、OAuth 登入 | 只有 ADMIN 能刪除商品 |

### 2. 核心元件

```
請求 → SecurityFilterChain（一串 filter）
        ├─ 認證的 filter：從請求取出憑證（帳密、JWT、cookie）
        │   → AuthenticationManager → AuthenticationProvider → UserDetailsService（從資料庫載入使用者）
        │   → 成功：把 Authentication 放進 SecurityContext
        ├─ ExceptionTranslationFilter：認證失敗 → AuthenticationEntryPoint（401）、權限不足 → AccessDeniedHandler（403）
        └─ AuthorizationFilter：依照規則檢查（authorizeHttpRequests）
     → Controller
```

| 元件 | 作用 | 30 Lab |
|---|---|---|
| `SecurityFilterChain` | 定義規則和 filter | `SecurityConfig` |
| `Authentication` | 「目前是誰、有什麼權限」 | `UsernamePasswordAuthenticationToken(userId, null, List.of())` |
| `SecurityContextHolder` | 存放目前請求的 `Authentication`（綁在執行緒上） | `JwtCookieFilter` 設定 |
| `UserDetailsService` | 依帳號載入使用者（Spring 內建的帳密登入用） | 沒用，自己在 `AuthService` 檢查密碼 |
| `PasswordEncoder` | 密碼雜湊 | `BCryptPasswordEncoder` |
| `AuthenticationEntryPoint` | 沒登入時的回應 | 轉成 `40100` / `40102` |

### 3. 角色與權限

```java
// 存在 Authentication 裡的權限
new UsernamePasswordAuthenticationToken(userId, null, List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));

// ① 在 SecurityFilterChain 依網址檢查
.authorizeHttpRequests(auth -> auth
        .requestMatchers("/api/admin/**").hasRole("ADMIN")       // 檢查 ROLE_ADMIN
        .requestMatchers(HttpMethod.DELETE, "/api/**").hasAuthority("product:delete")
        .anyRequest().authenticated())

// ② 在方法上檢查（要加 @EnableMethodSecurity）
@PreAuthorize("hasRole('ADMIN')")
public void deleteProduct(String id) { ... }

@PreAuthorize("#userId == authentication.principal")           // 只能改自己的資料
public void updateProfile(String userId, ...) { ... }
```

`hasRole("ADMIN")` 會自動加上 `ROLE_` 前綴去比對；`hasAuthority` 不會。

> 30 Lab 沒有角色（只有玩家）。做後台時就會用到。另外 `@PreAuthorize` 也是靠代理，有自我呼叫的問題。

### 4. 常見的登入方式

| 方式 | 說明 | 適合 |
|---|---|---|
| Session + cookie | 伺服器存 session，瀏覽器存 `JSESSIONID` | 傳統網站；Spring Security 的預設 |
| **JWT** | 伺服器不存狀態，token 裡帶使用者資訊和簽名 | 前後端分離、多台伺服器 |
| JWT + 伺服器端狀態 | JWT 驗簽 + Redis 檢查是否有效 | **30 Lab**：要能踢人下線 |
| OAuth 2 / OIDC | 「用 Google 登入」 | 第三方登入：`spring-boot-starter-oauth2-client` |
| Resource Server | 驗證別的系統（Keycloak、Auth0）發的 JWT | 微服務：`spring-boot-starter-oauth2-resource-server` |

### 5. CSRF 與 CORS

| | CSRF | CORS |
|---|---|---|
| 是什麼 | 惡意網站讓你的瀏覽器帶著 cookie 打你的網站 | 瀏覽器限制網頁打別的來源的 API |
| 誰的保護 | 保護使用者 | 保護使用者（瀏覽器強制） |
| 防法 | CSRF token、`SameSite` cookie、檢查 Origin | 後端回應 `Access-Control-Allow-Origin` 才允許 |
| Spring Security | 預設開啟（30 Lab 關掉，靠 `SameSite=Lax`） | 要明確設定 |

**用 cookie 登入時要考慮 CSRF**；用 `Authorization: Bearer` header 的 API 不受 CSRF 影響（瀏覽器不會自動帶 header）。

### 6. 安全的基本功

| 項目 | 做法 |
|---|---|
| 密碼 | BCrypt / Argon2 雜湊，**永遠不存明碼、不能還原** |
| SQL / NoSQL 注入 | 用參數化查詢（Spring Data、`Criteria` 都是），不要字串拼接查詢 |
| 敏感資料 | 不回傳（DTO 不放 `passwordHash`）、不寫進日誌（token、密碼） |
| 密鑰 | 環境變數或密鑰管理服務，不進 Git |
| 輸入驗證 | 所有外部輸入都驗證（`@Valid`） |
| 錯誤訊息 | 不把例外細節回給前端（`50000` 只說「系統繁忙」） |
| 帳號列舉 | 帳號不存在和密碼錯誤回同一個錯誤 |
| 暴力破解 | 登入失敗次數限制（Redis 計數、Bucket4j） |
| 依賴漏洞 | 定期升級；GitHub Dependabot |

---

## Part 2：日誌

### 7. SLF4J + Logback

Spring Boot 預設用 **SLF4J**（介面）+ **Logback**（實作）。≈ Node 的 pino / winston。

```java
@Slf4j                                                    // Lombok 產生 private static final Logger log
public class SettlementService {
    public void settle(Draw draw) {
        log.debug("開始結算 {}", draw.getDrawNo());         // {} 是佔位符
        log.info("結算完成 {} pool={}", drawNo, pool);
        log.warn("重試第 {} 次", attempt);
        log.error("結算失敗 {}", drawNo, exception);       // 最後一個參數是例外 → 印出完整的錯誤堆疊
    }
}
```

| 等級 | 用在 |
|---|---|
| `ERROR` | 需要人處理的錯誤 |
| `WARN` | 不正常但程式能處理（業務錯誤、重試） |
| `INFO` | 重要的業務事件（開獎、結算、啟動） |
| `DEBUG` | 開發時的細節 |
| `TRACE` | 更細的細節 |

> ⚠️ **用 `{}` 佔位符，不要用字串串接**：`log.debug("x=" + expensive())` 就算 DEBUG 沒開，`expensive()` 也會執行、字串也會建立。

### 8. 設定

```properties
logging.level.root=INFO
logging.level.com.thirtylab=DEBUG                         # 自己的程式
logging.level.org.springframework.data.mongodb.core.MongoTemplate=DEBUG   # 印出 Mongo 查詢
logging.level.org.hibernate.SQL=DEBUG                     # 印出 SQL（JPA）
logging.file.name=logs/app.log                            # 寫到檔案
logging.pattern.level=%5p [%X{requestId}]                 # 每行加上 MDC 的 requestId
```

**MDC**（Mapped Diagnostic Context）：把資料放進目前執行緒的「日誌上下文」，之後這條執行緒印的每一行日誌都帶著。最常放 request id、user id，查問題時可以把同一個請求的日誌串起來（[S3 第 7 節](12-web-mvc.md)）。

上線時通常輸出 **JSON 格式**的日誌，給 Loki、ELK、Datadog 之類的系統搜尋。Spring Boot 3.4+ 內建：`logging.structured.format.console=ecs`。

---

## Part 3：上線與維運

### 9. Actuator

```properties
management.endpoints.web.exposure.include=health,info,metrics,prometheus
management.endpoint.health.show-details=when-authorized
```

| 端點 | 用途 |
|---|---|
| `/actuator/health` | 健康檢查（負載平衡器、Render、Kubernetes 用） |
| `/actuator/health/liveness`、`/readiness` | Kubernetes 的存活 / 就緒探針 |
| `/actuator/info` | 版本資訊 |
| `/actuator/metrics` | JVM 記憶體、執行緒、HTTP 請求數、延遲 |
| `/actuator/prometheus` | 給 Prometheus 收集（要加 micrometer-registry-prometheus） |
| `/actuator/loggers` | **執行中改日誌等級**（不用重啟） |
| `/actuator/env`、`/beans`、`/mappings` | 除錯用：設定、所有 Bean、所有網址對應 |

> ⚠️ 除了 health，其他端點**不要對外公開**（會洩漏設定、內部結構）。30 Lab 只開了 `health`、`info`，上線時 health 也不顯示細節。

### 10. 打包與執行

```powershell
.\mvnw.cmd clean package
java -jar target/app.jar --spring.profiles.active=prod
```

### Docker（30 Lab 的 `backend/Dockerfile`，簡化過）

```dockerfile
FROM eclipse-temurin:21-jdk-jammy AS build      # 建置階段：要 JDK
WORKDIR /src
COPY mvnw pom.xml ./
COPY .mvn .mvn
COPY src src
RUN ./mvnw -B -DskipTests package && cp target/*.jar app.jar

FROM eclipse-temurin:21-jre-jammy               # 執行階段：只要 JRE，image 比較小
COPY --from=build /src/app.jar app.jar
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=60.0 -XX:+ExitOnOutOfMemoryError"
ENTRYPOINT ["java", "-jar", "app.jar"]
```

**multi-stage build**：建置時的工具不會留在最後的 image 裡。

更好的做法：

- **先 `COPY pom.xml` 再下載依賴，最後才 `COPY src`**：只改程式碼時，依賴那一層可以用快取
- Spring Boot 的 **layered jar**：把依賴和你的程式分層，image 更新更快
- **Buildpacks**：`.\mvnw.cmd spring-boot:build-image` 不用寫 Dockerfile 就能產生 image

### 11. 正式環境的檢查清單

| 項目 | 設定 |
|---|---|
| Profile | `SPRING_PROFILES_ACTIVE=prod` |
| 密鑰 | 環境變數（`JWT_SECRET`、資料庫密碼） |
| 記憶體 | `-XX:MaxRAMPercentage`，配合容器的限制 |
| 優雅關閉 | `server.shutdown=graceful`：關閉時等目前的請求處理完 |
| 日誌等級 | 自己的程式 INFO（30 Lab 的 `application-cloud.properties`） |
| 健康檢查 | `/actuator/health`，細節不公開 |
| HTTPS | 在負載平衡器 / 平台層處理；cookie 設 `Secure` |
| 資料庫遷移 | Flyway / Mongock 自動執行，不用 `ddl-auto=update` |
| 連線池 | 大小配合資料庫的連線上限（Atlas M0 最多 500 條連線） |
| 時區 | 程式全部用 UTC（`Instant`），不依賴伺服器的時區 |

### 12. 啟動慢、記憶體大怎麼辦

| 做法 | 效果 |
|---|---|
| `spring.main.lazy-initialization=true` | Bean 用到才建立，啟動快，但錯誤會延後到第一次使用才發現 |
| 移除用不到的 starter | 少一些自動設定 |
| **GraalVM Native Image** | 編譯成原生執行檔，啟動 < 0.1 秒、記憶體少很多；但建置很慢、反射要額外設定 |
| **CDS / AOT cache**（Java 21+ / 24+） | 預先處理 class，啟動快 30~50% |
| 虛擬執行緒 | 同樣的記憶體能處理更多同時的請求 |

---

## 面試常問

- **認證和授權的差別？** 你是誰 vs 你能做什麼；401 vs 403
- **Spring Security 的流程？** 一串 filter；認證 filter 取出憑證交給 AuthenticationManager；結果放進 SecurityContext；授權 filter 依規則檢查
- **JWT 的優缺點？** 優點：伺服器不存狀態、好擴展；缺點：發出去就收不回（要搭配黑名單 / 短效期 + refresh token / 伺服器端狀態）、payload 看得到
- **密碼怎麼存？** BCrypt 等慢雜湊 + salt，不能用 MD5 / SHA1
- **CSRF 是什麼？** 見第 5 節
- **怎麼監控 Spring Boot 程式？** Actuator + Micrometer → Prometheus + Grafana；結構化日誌；分散式追蹤（OpenTelemetry）
- **怎麼讓 Spring Boot 啟動更快？** 見第 12 節

## 小練習

1. 打開 http://localhost:8088/actuator/health ，再在 `application.properties` 暫時加上 `mappings`（`management.endpoints.web.exposure.include=health,info,mappings`），看看 `/actuator/mappings` 列出的所有網址（看完改回來）
2. 在 30 Lab 某個 Service 加一行 `log.debug("...{}", x)`，然後把 `logging.level.com.thirtylab` 改成 INFO，確認那行不印了
3. 讀 30 Lab 的 `backend/Dockerfile` 和 `render.yaml`，對照第 10、11 節，看哪些項目已經做了、哪些還沒

上一章：[S5 測試](14-testing.md)　下一章：[面試問答](16-interview-qa.md)
