# S3 Web 開發深入

## 1. 一個請求在 Spring MVC 裡的旅程

```
HTTP 請求
 → Tomcat
 → Filter 鏈（Spring Security 的 filter、你自己的 filter）           ≈ Express middleware
 → DispatcherServlet（Spring MVC 的總入口）
   → HandlerMapping：找出哪個 Controller 方法負責這個網址
   → HandlerInterceptor.preHandle                                   ≈ NestJS Interceptor（前）
   → HandlerMethodArgumentResolver：準備方法參數（@RequestParam、@RequestBody…）
     → HttpMessageConverter（Jackson）：JSON → Java 物件
     → @Valid 驗證
   → 你的 Controller 方法
   → HttpMessageConverter：Java 物件 → JSON
   → HandlerInterceptor.postHandle / afterCompletion
 → （有例外）HandlerExceptionResolver → @RestControllerAdvice
HTTP 回應
```

## 2. 對應網址

```java
@RestController                         // = @Controller + 每個方法都 @ResponseBody（回傳值直接當 body）
@RequestMapping("/api/products")
public class ProductController {
    // 示意：每一行的註解各自加在一個方法上

    @GetMapping                         // GET /api/products
    @GetMapping("/{id}")                // GET /api/products/42
    @PostMapping                        // POST /api/products
    @PutMapping("/{id}")                // 整個取代
    @PatchMapping("/{id}")              // 部分更新
    @DeleteMapping("/{id}")
    @GetMapping(value = "/search", params = "q")                     // 有 q 參數才符合
    @PostMapping(value = "/import", consumes = "multipart/form-data")
}
```

`@Controller`（沒有 Rest）是用來回傳 HTML 頁面（搭配 Thymeleaf 等模板）。前後端分離的專案都用 `@RestController`。

## 3. 拿請求的各種資料

```java
@GetMapping("/{id}")
public Result<ProductResponse> get(
        @PathVariable String id,                                        // /products/{id}
        @RequestParam(defaultValue = "zh-TW") String lang,              // ?lang=en
        @RequestParam(required = false) Integer limit,                  // 可以不給 → null
        @RequestParam List<String> tags,                                // ?tags=a&tags=b 或 ?tags=a,b
        @RequestHeader("X-Request-Id") String requestId,                // header
        @CookieValue(name = "tl_token", required = false) String token, // cookie
        @AuthenticationPrincipal String userId,                         // Spring Security 的目前使用者
        HttpServletRequest request) {                                   // 原始的請求（少用）
    ...
}

@PostMapping
public Result<ProductResponse> create(@Valid @RequestBody CreateProductRequest req) { ... }   // JSON body
```

### 很多 query 參數時：綁成一個物件

```java
public record ProductQuery(String keyword, Integer minPrice, Integer maxPrice, Integer page) { }

@GetMapping
public Result<PageResult<ProductResponse>> search(@Valid ProductQuery query) { ... }   // 不加 @RequestBody
// GET /api/products?keyword=球&minPrice=10&page=2
```

## 4. 回應與狀態碼

```java
// ① 直接回傳物件：狀態碼 200
@GetMapping
public Result<WalletResponse> balance() { ... }

// ② 固定的狀態碼
@PostMapping
@ResponseStatus(HttpStatus.CREATED)          // 201
public Result<ProductResponse> create(...) { ... }

// ③ 需要動態決定狀態碼或 header：ResponseEntity
@PostMapping
public ResponseEntity<Result<ProductResponse>> create(...) {
    ProductResponse p = service.create(req);
    return ResponseEntity
            .created(URI.create("/api/products/" + p.id()))   // 201 + Location header
            .body(Result.ok(p));
}

@DeleteMapping("/{id}")
public ResponseEntity<Void> delete(@PathVariable String id) {
    service.delete(id);
    return ResponseEntity.noContent().build();                 // 204
}
```

### 狀態碼怎麼選

| 狀態碼 | 意思 | 例子 |
|---|---|---|
| 200 OK | 成功 | 查詢、更新 |
| 201 Created | 建立成功 | 新增資源 |
| 204 No Content | 成功、沒有內容 | 刪除 |
| 400 Bad Request | 請求格式錯 | 驗證失敗 |
| 401 Unauthorized | 沒登入 / 登入無效 | |
| 403 Forbidden | 登入了但沒權限 | |
| 404 Not Found | 找不到 | |
| 409 Conflict | 跟目前的狀態衝突 | 帳號重複、積分不足 |
| 422 Unprocessable Entity | 格式對但業務上不行 | 有些團隊用來代替 400 / 409 |
| 429 Too Many Requests | 被限流 | |
| 500 Internal Server Error | 伺服器的 bug | |

> 30 Lab 的做法是「HTTP 狀態碼 + body 裡的 5 位數業務錯誤碼」。也有團隊**永遠回 200**，只看 body 的 code；或用 RFC 9457 的 **Problem Details**（`application/problem+json`，Spring 內建 `ProblemDetail` 類別）。選一種，整個專案一致就好。

## 5. Jackson：JSON 的轉換

### 常用註解

```java
public record UserResponse(
        String id,
        @JsonProperty("display_name") String nickname,          // JSON 的 key 改名
        @JsonIgnore String passwordHash,                        // 不輸出（敏感資料最好根本不放進 DTO）
        @JsonInclude(JsonInclude.Include.NON_NULL) String bio,  // null 時不輸出這個 key
        @JsonFormat(pattern = "yyyy-MM-dd") LocalDate birthday  // 日期格式
) { }
```

### 全域設定（`application.properties`）

```properties
spring.jackson.default-property-inclusion=non_null     # 所有 null 欄位都不輸出
spring.jackson.property-naming-strategy=SNAKE_CASE     # 全部轉成 snake_case
spring.jackson.deserialization.fail-on-unknown-properties=true   # 收到不認識的欄位就報錯
```

### 預設行為

| Java | JSON |
|---|---|
| `Instant` | `"2026-10-23T03:30:00Z"`（ISO 字串） |
| `LocalDate` | `"2026-10-23"` |
| enum | 名稱字串 `"SECOND"` |
| `null` | `null`（預設會輸出） |
| `long` 很大的數字 | 數字（⚠️ 超過 2^53 前端 JS 會失去精度，這種 id 要用字串） |
| JSON 有、Java 沒有的欄位 | 預設**忽略** |
| JSON 沒有、Java 有的欄位 | 基本型別是 0 / false，物件是 null |

> Spring Boot 4 用的是 **Jackson 3**：設定類別的 package 從 `com.fasterxml.jackson.databind` 改成 `tools.jackson.databind`；但**註解**（`@JsonProperty`、`@JsonIgnore`）還在 `com.fasterxml.jackson.annotation`。

## 6. CORS

瀏覽器從 `http://localhost:3100` 打 `http://localhost:8088` 是跨來源，後端要明確允許：

```java
// ① 單一 Controller
@CrossOrigin(origins = "http://localhost:3100")
@RestController
public class XxxController { ... }

// ② 全域
@Configuration
public class WebConfig implements WebMvcConfigurer {
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins("http://localhost:3100")
                .allowedMethods("GET", "POST", "PUT", "DELETE")
                .allowCredentials(true);          // 要帶 cookie 時
    }
}
```

有 Spring Security 時，還要在 `SecurityFilterChain` 裡 `.cors(Customizer.withDefaults())`。

> 30 Lab 的 HTTP 請求都經過 Next.js 的 rewrite（同一個來源），所以**沒有設 HTTP 的 CORS**；只有直連後端的 WebSocket 用 `setAllowedOrigins` 檢查來源。

## 7. Filter、Interceptor、AOP 的差別

三個都能「在請求前後做事」：

| | Filter | HandlerInterceptor | AOP |
|---|---|---|---|
| 屬於 | Servlet（Tomcat） | Spring MVC | Spring |
| 什麼時候執行 | 最外層，`DispatcherServlet` 之前 | 找到 Controller 之後、執行前後 | 任何 Bean 的方法 |
| 拿得到 | 原始的 request / response | request、**要執行哪個 Controller 方法** | 方法參數、回傳值 |
| 適合 | 認證、CORS、壓縮、request id、記錄所有請求 | 跟 Controller 有關的檢查、記錄 | 交易、快取、計時、權限 |
| 30 Lab 的例子 | `JwtCookieFilter` | （沒有） | `@Transactional` |

```java
// Filter：每個請求加一個 request id，放進日誌
@Component
public class RequestIdFilter extends OncePerRequestFilter {
    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        String id = UUID.randomUUID().toString();
        MDC.put("requestId", id);               // 之後這個請求的所有日誌都帶這個 id
        res.setHeader("X-Request-Id", id);
        try {
            chain.doFilter(req, res);           // ≈ next()
        } finally {
            MDC.remove("requestId");
        }
    }
}

// Interceptor
@Component
public class TimingInterceptor implements HandlerInterceptor {
    @Override
    public boolean preHandle(HttpServletRequest req, HttpServletResponse res, Object handler) {
        req.setAttribute("start", System.nanoTime());
        return true;                            // false = 不繼續執行 Controller
    }
    @Override
    public void afterCompletion(HttpServletRequest req, HttpServletResponse res, Object handler, Exception ex) {
        long ms = (System.nanoTime() - (long) req.getAttribute("start")) / 1_000_000;
        log.info("{} {} {}ms", req.getMethod(), req.getRequestURI(), ms);
    }
}
// Interceptor 要註冊：在 WebMvcConfigurer 的 addInterceptors 裡 registry.addInterceptor(timingInterceptor)
```

## 8. 驗證的進階用法

### 驗證 Service 的參數

```java
@Service
@Validated                                           // class 上加這個
public class TransferService {
    public void transfer(@NotBlank String to, @Positive long amount) { ... }   // 參數不合法丟 ConstraintViolationException
}
```

### 群組：同一個 DTO，新增和更新的規則不同

```java
public interface OnCreate { }
public interface OnUpdate { }

public record ProductRequest(
        @Null(groups = OnCreate.class) @NotNull(groups = OnUpdate.class) String id,
        @NotBlank(groups = {OnCreate.class, OnUpdate.class}) String name) { }

@PostMapping public void create(@Validated(OnCreate.class) @RequestBody ProductRequest req) { }
@PutMapping public void update(@Validated(OnUpdate.class) @RequestBody ProductRequest req) { }
```

通常直接用兩個 DTO 比較清楚。

### 驗證巢狀物件

```java
public record OrderRequest(
        @NotNull @Valid AddressRequest address,            // 巢狀物件要加 @Valid 才會往下驗證
        @NotEmpty List<@Valid OrderItemRequest> items) { }
```

## 9. 檔案上傳

```java
@PostMapping(value = "/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
public Result<String> upload(@RequestParam("file") MultipartFile file) throws IOException {
    if (file.isEmpty() || file.getSize() > 2_000_000) throw new BusinessException(ErrorCode.BAD_REQUEST);
    String contentType = file.getContentType();            // 不要相信這個，要自己檢查檔案內容
    byte[] bytes = file.getBytes();
    ...
}
```

```properties
spring.servlet.multipart.max-file-size=2MB
spring.servlet.multipart.max-request-size=10MB
```

## 10. 呼叫別的 API：`RestClient`

```java
@Configuration
public class ClientConfig {
    @Bean
    RestClient weatherClient(RestClient.Builder builder) {
        return builder.baseUrl("https://api.example.com")
                .defaultHeader("Authorization", "Bearer xxx")
                .build();
    }
}

@Service
@RequiredArgsConstructor
public class WeatherService {
    private final RestClient weatherClient;

    public Forecast today(String city) {
        return weatherClient.get()
                .uri("/forecast?city={city}", city)          // 參數會自動 URL encode
                .retrieve()
                .onStatus(HttpStatusCode::is4xxClientError, (req, res) -> {
                    throw new BusinessException(ErrorCode.BAD_REQUEST);
                })
                .body(Forecast.class);                        // JSON → record
    }
}
```

≈ axios 的 instance。舊的寫法是 `RestTemplate`（還能用，但不再新增功能）；非同步的是 `WebClient`。

**一定要設 timeout**：外部服務卡住時，你的請求執行緒也會一直卡著。

### 宣告式的 HTTP client

```java
public interface WeatherApi {
    @GetExchange("/forecast")
    Forecast forecast(@RequestParam String city);
}
// 用 HttpServiceProxyFactory 建立實作，跟 Spring Data 的 Repository 一樣只寫 interface
```

## 11. 分頁的慣例

```java
@GetMapping
public Page<Product> list(Pageable pageable) { ... }
// GET /api/products?page=0&size=20&sort=price,desc
```

Spring Data 可以直接把 query 轉成 `Pageable`（⚠️ 頁碼從 **0** 開始）。30 Lab 自己定義了 `page` 從 1 開始的 `PageResult`，因為對前端比較直覺。

---

## 面試常問

- **Spring MVC 處理請求的流程？** 見第 1 節
- **`@Controller` 和 `@RestController` 的差別？** 後者每個方法都加了 `@ResponseBody`，回傳值直接序列化成 body
- **`@RequestParam`、`@PathVariable`、`@RequestBody` 的差別？** query 參數、路徑的一部分、JSON body
- **Filter 和 Interceptor 的差別？** 見第 7 節
- **怎麼做全域錯誤處理？** `@RestControllerAdvice` + `@ExceptionHandler`
- **PUT 和 PATCH 的差別？** PUT 整個取代；PATCH 部分更新
- **CORS 是什麼？怎麼設定？** 瀏覽器的同源政策；後端回應 `Access-Control-Allow-*` header 允許跨來源

## 小練習

1. 在 30 Lab 加一個 `RequestIdFilter`（第 7 節），在 `application.properties` 設 `logging.pattern.level=%5p [%X{requestId}]`，看日誌每行多了 request id
2. 用 `RestClient` 寫一個小程式呼叫 `https://api.github.com/users/octocat`，轉成 record 印出 `login` 和 `public_repos`
3. 打開 30 Lab 的 `AuthController`，它為什麼回傳 `ResponseEntity` 而不是直接回 `Result`？

上一章：[S2 IoC 容器與 AOP](11-ioc-aop.md)　下一章：[S4 資料存取與交易](13-data-jpa-transactions.md)
