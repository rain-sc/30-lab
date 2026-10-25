# J9 Maven

Maven 是 Java 的建置工具：管理依賴、編譯、跑測試、打包。≈ npm + package.json + 部分的 webpack / tsc。另一個常見的工具是 **Gradle**（Android、新專案常用），概念一樣，設定檔是程式碼（`build.gradle.kts`）。

## 1. `pom.xml` 的結構

```xml
<project>
    <modelVersion>4.0.0</modelVersion>

    <!-- 繼承 Spring Boot 的設定：決定所有 spring 套件的版本、預設的 plugin 設定 -->
    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>4.1.1</version>
    </parent>

    <!-- 這個專案的「座標」 -->
    <groupId>com.thirtylab</groupId>
    <artifactId>30-lab-backend</artifactId>
    <version>0.0.1-SNAPSHOT</version>

    <!-- 變數 -->
    <properties>
        <java.version>21</java.version>
        <jjwt.version>0.13.0</jjwt.version>
    </properties>

    <!-- 依賴 ≈ dependencies + devDependencies -->
    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-webmvc</artifactId>
            <!-- 沒寫版本：由 parent 決定 -->
        </dependency>
        <dependency>
            <groupId>io.jsonwebtoken</groupId>
            <artifactId>jjwt-api</artifactId>
            <version>${jjwt.version}</version>
        </dependency>
    </dependencies>

    <!-- 建置設定：plugin -->
    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>   <!-- 打包成可執行的 fat jar -->
            </plugin>
        </plugins>
    </build>
</project>
```

### 座標（GAV）

每個套件用三個值唯一識別：

| | 意思 | npm 對照 |
|---|---|---|
| `groupId` | 組織（反過來的網域） | npm 的 scope `@spring` |
| `artifactId` | 套件名稱 | 套件名稱 |
| `version` | 版本 | 版本 |

`-SNAPSHOT` 結尾的版本代表「開發中、還沒正式發布」。

套件從 **Maven Central**（≈ npmjs.com）下載，存在 `~/.m2/repository/`（≈ 全域的 npm cache）。所有專案共用，同一個版本只下載一次。

> 找套件：https://central.sonatype.com/ 或 https://mvnrepository.com/ ，搜尋後複製 `<dependency>` 那段。

## 2. 依賴範圍（scope）

| scope | 編譯時 | 測試時 | 執行時（打包） | 例子 | npm 對照 |
|---|---|---|---|---|---|
| `compile`（預設） | ✅ | ✅ | ✅ | spring-boot-starter-webmvc | dependencies |
| `provided` | ✅ | ✅ | ❌（執行環境會提供） | servlet-api（部署到外部 Tomcat 時） | peerDependencies |
| `runtime` | ❌ | ✅ | ✅ | 資料庫 driver（程式只依賴介面） | — |
| `test` | ❌ | ✅ | ❌ | spring-boot-starter-test、JUnit | devDependencies |
| `optional=true` | | | 不會傳給依賴你的專案 | lombok、devtools | |

## 3. 版本管理：parent 與 BOM

Spring 有幾十個套件，彼此版本要相容。`spring-boot-starter-parent` 裡定義了「Spring Boot 4.1.1 搭配的每個套件的版本」，所以你寫依賴時不用寫版本。

**不能用 parent 時用 BOM**（Bill of Materials）：

```xml
<dependencyManagement>
    <dependencies>
        <dependency>
            <groupId>org.testcontainers</groupId>
            <artifactId>testcontainers-bom</artifactId>
            <version>1.21.0</version>
            <type>pom</type>
            <scope>import</scope>
        </dependency>
    </dependencies>
</dependencyManagement>
<!-- 之後 testcontainers 的各個模組都不用寫版本 -->
```

**升級 Spring Boot 只要改 parent 的版本**，其他套件跟著升級（≈ 升級一個 monorepo 的鎖定檔）。

### 傳遞依賴

你依賴 A，A 依賴 B，B 也會被下載（跟 npm 一樣）。看完整的依賴樹：

```powershell
.\mvnw.cmd dependency:tree                     # ≈ npm ls
.\mvnw.cmd dependency:tree -Dincludes=com.fasterxml.jackson.core   # 只看某個套件從哪來
```

**版本衝突**：兩個依賴要求同一個套件的不同版本時，Maven 選「離你最近的那個」（依賴樹上層級最少的），同一層的話選先宣告的。npm 可以同時裝兩個版本，**Java 的 classpath 上一個 class 只能有一個版本**，所以衝突時會出現 `NoSuchMethodError`。解法：在 `<dependencyManagement>` 指定版本，或用 `<exclusions>` 排除。

## 4. 生命週期

Maven 的指令是「跑到某個階段」，**會自動執行前面所有的階段**：

```
validate → compile → test → package → verify → install → deploy
```

| 指令 | 做什麼 | npm 對照 |
|---|---|---|
| `mvnw compile` | 編譯 `src/main/java` → `target/classes` | `tsc` |
| `mvnw test` | 編譯 + 編譯測試 + 跑測試 | `npm test` |
| `mvnw package` | 上面全部 + 打包成 jar | `npm run build` |
| `mvnw verify` | 上面全部 + 整合測試、檢查 | CI 跑的那套 |
| `mvnw install` | 上面全部 + 放進本機的 `~/.m2`（給本機其他專案用） | `npm link` |
| `mvnw clean` | 刪掉 `target/` | `rm -rf dist` |
| `mvnw spring-boot:run` | 編譯並啟動（plugin 提供的指令） | `npm run start:dev` |

常用參數：

```powershell
.\mvnw.cmd clean package -DskipTests          # 打包，跳過測試
.\mvnw.cmd test -Dtest=PrizeCalculatorTest    # 只跑一個測試類別
.\mvnw.cmd -q test                            # 安靜模式，只顯示錯誤
.\mvnw.cmd -o package                         # 離線模式（不檢查網路上的新版本）
.\mvnw.cmd -U package                         # 強制更新 SNAPSHOT 依賴
```

## 5. Maven Wrapper（`mvnw`）

`mvnw` / `mvnw.cmd` + `.mvn/wrapper/` 會自動下載專案指定版本的 Maven，**不用自己安裝 Maven**，每個人用的版本都一樣。≈ 用 `npx` 執行鎖定版本的工具。一律用 `.\mvnw.cmd`，不要用系統裝的 `mvn`。

## 6. 專案結構慣例

Maven 強制規定資料夾結構（約定優於設定）：

```
src/main/java/          程式碼
src/main/resources/     設定檔、靜態檔案（會被複製到 classpath）
src/test/java/          測試
src/test/resources/     測試用的設定檔
target/                 所有產出（不要進 Git）
```

放錯位置 Maven 就找不到。例如設定檔放在 `src/main/java/` 不會被打包。

## 7. 在 IntelliJ 裡

- 右邊的 **Maven 視窗**：可以直接點 Lifecycle 的 `test`、`package` 執行
- 改了 `pom.xml` 之後要按 **Reload**（或 `Ctrl + Shift + O`），IntelliJ 才會下載新依賴
- 程式碼一片紅但 `mvnw compile` 正常：Reload Maven，或 File → Invalidate Caches

---

## 常見錯誤

| 錯誤 | 原因 |
|---|---|
| `Could not resolve dependencies` / `Could not find artifact` | 名稱或版本打錯；公司網路擋了 Maven Central |
| `package xxx does not exist` | 少了依賴，或 IntelliJ 還沒 Reload |
| `NoSuchMethodError` / `ClassNotFoundException`（執行時） | 版本衝突，用 `dependency:tree` 查 |
| `release version 21 not supported` | 執行 Maven 的 JDK 版本太舊（`JAVA_HOME`） |
| 改了程式但跑起來還是舊的 | `target/` 裡有舊的編譯結果，`clean` 一下 |

## 面試常問

- **Maven 的生命週期？** validate、compile、test、package、verify、install、deploy；執行某個階段會先執行前面所有階段
- **依賴的 scope 有哪些？** compile、provided、runtime、test
- **依賴衝突怎麼解決？** `dependency:tree` 找出來源，用 `dependencyManagement` 鎖版本或 `exclusions` 排除
- **Maven 和 Gradle 的差別？** Maven 用 XML、約定固定、穩定；Gradle 用程式碼設定、彈性大、增量建置快

## 小練習

1. 執行 `.\mvnw.cmd dependency:tree`，找到 `spring-boot-starter-webmvc` 底下帶進來的 Tomcat 和 Jackson
2. 執行 `.\mvnw.cmd help:effective-pom > pom-effective.xml`，看看繼承 parent 之後完整的設定有多長（看完刪掉）
3. 在 `pom.xml` 找到 Lombok 和 DevTools，它們各自設了什麼（`optional`、`scope`）？為什麼？
   <details><summary>答案</summary>Lombok 是 <code>optional</code>：它只在編譯時產生程式碼，執行時不需要，而且不會傳給依賴這個專案的人；下面 <code>maven-compiler-plugin</code> 的 <code>annotationProcessorPaths</code> 也列了它，讓編譯器執行它。DevTools 是 <code>runtime</code> + <code>optional</code>：只在執行時需要，打包時 Spring Boot plugin 會排除它，正式環境不會有熱重啟。</details>

上一章：[J8 日期時間與新版 Java](08-time-and-modern-java.md)　下一章：[S1 Spring Boot 全貌](10-spring-boot-overview.md)
