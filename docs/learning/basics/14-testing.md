# S5 測試

[專案教程第 14 章](../backend/14-testing.md) 講了 30 Lab 用到的兩種測試（單元測試、`@SpringBootTest` 整合測試）。這章補完整的工具箱：Mockito、測試切片、MockMvc、Testcontainers。

## 1. 測試金字塔

```
          ╱  E2E  ╲          少：慢、脆弱（Playwright 打整個系統）
        ╱ 整合測試  ╲        中：Spring + 真的資料庫
      ╱  單元測試    ╲      多：毫秒級，只測一個 class
```

| 種類 | 工具 | 速度 | 測什麼 |
|---|---|---|---|
| 單元測試 | JUnit + Mockito | 毫秒 | 一個 class 的邏輯，依賴用假的 |
| 切片測試 | `@WebMvcTest`、`@DataMongoTest` | 1~2 秒 | 只啟動某一層 |
| 整合測試 | `@SpringBootTest` + 真的資料庫 | 數秒 | 多個 class 合作的結果 |

## 2. JUnit 5 的基本

```java
class CalculatorTest {

    private Calculator calc;

    @BeforeAll static void beforeAll() { }      // 整個類別開始前一次（static）
    @BeforeEach void setUp() { calc = new Calculator(); }   // 每個測試前
    @AfterEach void tearDown() { }
    @AfterAll static void afterAll() { }

    @Test
    @DisplayName("兩個正數相加")
    void addsPositives() {
        assertThat(calc.add(1, 2)).isEqualTo(3);
    }

    @Test
    @Disabled("等 #42 修好")                       // ≈ test.skip
    void skipped() { }

    @ParameterizedTest                             // ≈ test.each
    @CsvSource({ "1, 2, 3", "-1, 1, 0" })
    void adds(int a, int b, int expected) {
        assertThat(calc.add(a, b)).isEqualTo(expected);
    }

    @ParameterizedTest
    @ValueSource(strings = { "", "  " })
    void blankIsRejected(String input) { ... }

    @ParameterizedTest
    @EnumSource(PrizeTier.class)                    // 每個 enum 值跑一次
    void everyTierHasPrize(PrizeTier tier) { ... }

    @Nested                                         // ≈ describe 巢狀
    class WhenEmpty { @Test void ... }
}
```

| Jest | JUnit 5 |
|---|---|
| `describe` | class / `@Nested` |
| `test` / `it` | `@Test` |
| `beforeEach` / `afterEach` | `@BeforeEach` / `@AfterEach` |
| `beforeAll` | `@BeforeAll`（static） |
| `test.each` | `@ParameterizedTest` |
| `test.skip` | `@Disabled` |
| `expect(x).toBe(y)` | `assertThat(x).isEqualTo(y)`（AssertJ） |

## 3. AssertJ 常用斷言

```java
assertThat(name).isEqualTo("Rain").startsWith("R").hasSize(4);
assertThat(balance).isPositive().isBetween(0L, 10_000L);
assertThat(user).isNull(); assertThat(opt).isPresent().contains(user);
assertThat(list).hasSize(3).contains("a").doesNotContain("z").containsExactly("a", "b", "c");
assertThat(list).containsExactlyInAnyOrder("c", "a", "b");
assertThat(tickets).extracting(Ticket::getStatus).containsOnly(TicketStatus.PAID);
assertThat(tickets).filteredOn(t -> t.getPayout() > 0).hasSize(2);
assertThat(tickets).allSatisfy(t -> assertThat(t.getCost()).isPositive());
assertThat(map).containsEntry("a", 1).containsKey("b");
assertThat(result).usingRecursiveComparison().ignoringFields("id", "createdAt").isEqualTo(expected);

assertThatThrownBy(() -> service.place(...))
        .isInstanceOf(BusinessException.class)
        .hasMessageContaining("積分");
assertThatThrownBy(() -> ...)
        .isInstanceOfSatisfying(BusinessException.class,
                e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.INSUFFICIENT_POINTS));
assertThatNoException().isThrownBy(() -> ...);
```

## 4. Mockito：假的依賴

**單元測試只測一個 class**，它的依賴用「假的」代替，才能控制依賴回傳什麼、檢查有沒有被呼叫。≈ `jest.fn()`、`jest.mock()`。

```java
@ExtendWith(MockitoExtension.class)
class DailyBonusServiceTest {

    @Mock WalletService walletService;                          // 假的
    @Mock WalletTransactionRepository transactionRepository;
    WalletProperties props = new WalletProperties(10_000, 1_000);   // 簡單的值物件直接 new

    DailyBonusService service;

    @BeforeEach
    void setUp() {
        service = new DailyBonusService(walletService, transactionRepository, props);
    }

    @Test
    void claimCreditsDailyBonus() {
        // 準備：設定假物件的行為（≈ mockReturnValue）
        when(transactionRepository.existsByTypeAndRefId(any(), anyString())).thenReturn(false);
        when(walletService.credit(eq("u1"), eq(1_000L), eq(WalletTransactionType.DAILY_BONUS), anyString()))
                .thenReturn(11_000L);

        // 執行
        var res = service.claim("u1", Instant.parse("2026-10-23T03:00:00Z"));

        // 檢查結果
        assertThat(res.balance()).isEqualTo(11_000);
        // 檢查有沒有被呼叫、用什麼參數（≈ toHaveBeenCalledWith）
        verify(walletService).credit("u1", 1_000L, WalletTransactionType.DAILY_BONUS, "u1:2026-10-23");
    }

    @Test
    void alreadyClaimedThrows() {
        when(transactionRepository.existsByTypeAndRefId(any(), anyString())).thenReturn(true);

        assertThatThrownBy(() -> service.claim("u1", Instant.now()))
                .isInstanceOf(BusinessException.class);
        verify(walletService, never()).credit(any(), anyLong(), any(), any());    // 確認沒有加錢
    }
}
```

| Jest | Mockito |
|---|---|
| `jest.fn()` / `jest.mock` | `@Mock` / `mock(X.class)` |
| `.mockReturnValue(v)` | `when(mock.method()).thenReturn(v)` |
| `.mockImplementation(...)` | `when(...).thenAnswer(inv -> ...)` |
| `.mockRejectedValue(e)` | `when(...).thenThrow(e)` |
| `expect(fn).toHaveBeenCalledWith(...)` | `verify(mock).method(...)` |
| `expect(fn).not.toHaveBeenCalled()` | `verify(mock, never()).method(...)` |
| `expect(fn).toHaveBeenCalledTimes(2)` | `verify(mock, times(2)).method(...)` |
| `expect.any(String)` | `any()`、`anyString()`、`anyLong()`、`eq(x)` |

> ⚠️ 一旦有一個參數用了 `any()` / `eq()` 這種 matcher，**所有參數都要用 matcher**。
> `void` 方法要讓它丟例外：`doThrow(new X()).when(mock).voidMethod();`

### 什麼時候用 mock、什麼時候用真的

| 用 mock | 用真的 |
|---|---|
| 外部服務（付款、寄信、第三方 API） | 簡單的值物件、設定（`new WalletProperties(...)`） |
| 想測「依賴失敗時」的情況 | 資料庫查詢的正確性（mock 測不出查詢寫錯） |
| 依賴很慢 | 要測多個 class 合作的結果 |

**30 Lab 選擇不用 mock**，Service 的測試直接連真的 MongoDB：因為大部分的邏輯在「條件更新、唯一索引、交易」，這些只有真的資料庫才測得出來。這是合理的取捨。

## 5. 測試切片：只啟動需要的部分

`@SpringBootTest` 啟動整個程式，比較慢。切片只啟動某一層：

| 註解 | 啟動什麼 | 用來測 |
|---|---|---|
| `@WebMvcTest(XxxController.class)` | Controller、`@RestControllerAdvice`、Filter、Jackson、Security；**不建立 Service** | HTTP 層：路徑、參數、驗證、狀態碼、JSON 格式 |
| `@DataMongoTest` | Repository、`MongoTemplate` | 查詢 |
| `@DataJpaTest` | JPA、Repository（預設每個測試結束後回滾） | JPA 查詢 |
| `@JsonTest` | Jackson | 序列化格式 |

> Spring Boot 4 把它們搬到各自的模組，例如 `@WebMvcTest` 在 `org.springframework.boot.webmvc.test.autoconfigure`，需要對應的 test starter（30 Lab 的 `pom.xml` 已經有 `spring-boot-starter-webmvc-test`）。

## 6. MockMvc：測 HTTP 層（30 Lab 還沒寫的那一塊）

**能抓到「Controller 漏寫」「`permitAll` 忘了加」「驗證規則不對」**，這些 Service 的測試抓不到。

```java
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class GameRulesApiTest {

    @Autowired MockMvc mvc;

    @Test
    void rulesArePublic() throws Exception {
        mvc.perform(get("/api/game/rules"))                       // 不帶 cookie
                .andExpect(status().isOk())                       // 不是 401
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.maxNumber").value(49))     // 測試設定是 49 球
                .andExpect(jsonPath("$.data.prizes.length()").value(7));
    }

    @Test
    void walletRequiresLogin() throws Exception {
        mvc.perform(get("/api/wallet"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(40100));
    }

    @Test
    void invalidBetReturnsFieldViolations() throws Exception {
        mvc.perform(post("/api/tickets")
                        .cookie(new Cookie("tl_token", loginAndGetToken()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "drawNo": "", "idempotencyKey": "k1", "lines": [[1, 2, 3]] }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(40001))
                .andExpect(jsonPath("$.data[*].field", hasItem("drawNo")));
    }
}
```

### 用 `@WebMvcTest` + `@MockitoBean`：只測 Controller

```java
@WebMvcTest(WalletController.class)
class WalletControllerTest {

    @Autowired MockMvc mvc;
    @MockitoBean WalletService walletService;                // 放進 Spring 容器的假物件
    @MockitoBean DailyBonusService dailyBonusService;

    @Test
    void balance() throws Exception {
        when(walletService.balance("u1")).thenReturn(new WalletResponse(9_990));

        mvc.perform(get("/api/wallet")
                        // 假裝已登入（spring-security-test）：principal 直接放字串 "u1"，
                        // 跟 30 Lab 的 JwtCookieFilter 一樣，Controller 的 @AuthenticationPrincipal String 才拿得到
                        .with(authentication(new UsernamePasswordAuthenticationToken("u1", null, List.of()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.balance").value(9990));
    }
}
```

> 常見的 `@WithMockUser(username = "u1")` 放進去的 principal 是一個 `User` 物件，不是字串；30 Lab 的 Controller 寫的是 `@AuthenticationPrincipal String userId`，會拿到 `null`。**假的登入要跟真的 filter 放進去的型別一樣**。

> `@MockitoBean` 取代了舊的 `@MockBean`（Spring Boot 4 已經移除 `@MockBean`）。
> 30 Lab 的 Security 是自訂的 JWT filter，`@WebMvcTest` 要另外把 `SecurityConfig` 和它需要的 Bean 加進來，比較麻煩；用 `@SpringBootTest` + `@AutoConfigureMockMvc` 打整個流程比較直接。

## 7. Testcontainers：測試時自動開一個乾淨的資料庫

30 Lab 的整合測試需要先 `docker compose up`，而且用的是你本機的 MongoDB。**Testcontainers** 在測試開始時自動啟動一個 Docker 容器，測完自動刪掉：

```java
@SpringBootTest
@Testcontainers
class SettlementIT {

    @Container
    @ServiceConnection                              // Spring Boot 自動把連線資訊設好
    static MongoDBContainer mongo = new MongoDBContainer("mongo:8.0");   // 預設就是單節點副本集，支援交易

    @Container
    @ServiceConnection(name = "redis")
    static GenericContainer<?> redis = new GenericContainer<>("redis:7.4-alpine").withExposedPorts(6379);

    @Test
    void ... { }
}
```

好處：

- 不用先開 Docker Compose，`mvnw test` 一個指令就好
- 每次都是乾淨的資料庫，不會被本機的資料影響
- **可以在 GitHub Actions 上跑**（CI 的機器有 Docker）

代價：第一次要下載 image，每次啟動容器多幾秒。

## 8. 好的測試長怎樣

| 原則 | 說明 |
|---|---|
| 一個測試測一件事 | 名稱說清楚在測什麼：`alreadyClaimedThrows` |
| Arrange → Act → Assert | 準備 → 執行 → 檢查，三段分開 |
| 測行為，不測實作 | 檢查結果（餘額、狀態），而不是「呼叫了哪些私有方法」 |
| 測試之間互不影響 | 每個測試自己準備資料、`@BeforeEach` 清乾淨；不依賴執行順序 |
| 固定的時間、固定的亂數 | 不要在測試裡用 `Instant.now()` |
| 測邊界 | 0、1、上限、上限 + 1、空的、null |
| 失敗訊息要看得懂 | AssertJ 的訊息通常夠清楚；複雜的加 `.as("說明")` |

---

## 面試常問

- **單元測試和整合測試的差別？** 單元測試只測一個 class，依賴用 mock，很快；整合測試測多個元件合作，用真的資料庫等，比較慢但更接近真實
- **Mockito 的 `@Mock` 和 `@MockitoBean` 的差別？** `@Mock` 是純 Mockito 的假物件，不在 Spring 容器裡；`@MockitoBean` 把假物件放進 Spring 容器，取代真的 Bean
- **`@SpringBootTest` 和 `@WebMvcTest` 的差別？** 前者啟動整個程式；後者只啟動 Web 層
- **怎麼測 Controller？** MockMvc
- **怎麼在測試裡用真的資料庫？** Testcontainers，或像 30 Lab 用獨立的測試資料庫

## 小練習

1. 照第 4 節，用 Mockito 寫 `DailyBonusService` 的單元測試（它的依賴都是建構子注入，很好 mock）
2. 照第 6 節，在 30 Lab 加一個 `PublicApiTest`：檢查所有「不用登入」的 API 不帶 cookie 時都不是 401。這個測試能防止「`permitAll` 忘了加」再發生
3. 加 Testcontainers 依賴，把一個整合測試改成用 `MongoDBContainer`，停掉 docker compose 再跑跑看

上一章：[S4 資料存取與交易](13-data-jpa-transactions.md)　下一章：[S6 安全與上線](15-security-and-ops.md)
