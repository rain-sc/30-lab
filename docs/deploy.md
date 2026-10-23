# 免費上線

前端放 Vercel，後端放 Render，MongoDB 用 Atlas M0，Redis 用 Upstash。機器人腳本留在自己的電腦。全部先用免費額度。帳號還沒開也可以，程式已經留好接點，開好之後照下面的順序填。

本機開發不用改任何東西：不設 `SPRING_PROFILES_ACTIVE` 就還是連 Docker 裡的 MongoDB 和 Redis。

## 已經接好的部分

| 位置 | 作用 |
|---|---|
| `render.yaml` | Render 的服務定義。`sync: false` 的變數要在 Dashboard 填，不會進 Git |
| `backend/Dockerfile` | Render 用它建置。記憶體上限約 512 MB 的六成，避免免費機器被 Spring Boot 撐爆 |
| `backend/src/main/resources/application-cloud.properties` | 只在 `SPRING_PROFILES_ACTIVE=cloud` 時生效：Upstash 的 TLS、帳號、密碼，以及把日誌從 DEBUG 降到 INFO |
| `server.port` | Render 注入的 `PORT` 優先，本機仍是 8088 |
| 前端 `BACKEND_URL`、`NEXT_PUBLIC_WS_URL` | 原本就有。Vercel 要在**建置前**設好，改了要重新部署 |

## 建議順序

先有資料庫，再部署後端，最後部署前端。前端的網址要回填到後端的 `CORS_ALLOWED_ORIGINS`，WebSocket 才接得上。

### 1. MongoDB Atlas（M0）

1. 建立免費集群 M0。區域選 **AWS Singapore（ap-southeast-1）**，離 Render 的 Singapore 近。
2. Database Access 建一個資料庫使用者。密碼若有 `@`、`:`、`/` 這類字元，放進連線字串前要先 URL encode。
3. Network Access 暫時允許 `0.0.0.0/0`。Render 免費方案的出口 IP 不固定，鎖單一 IP 會連不上。
4. 連線字串選 Drivers，資料庫名稱用 `marksixlab`。**不要**加本機用的 `directConnection=true`。M0 本身是副本集，下注那種多文件交易可以用。

範例：

```text
mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/marksixlab?retryWrites=true&w=majority
```

### 2. Upstash Redis

1. 建立一個 Regional 的 Redis，區域同樣選靠近 Singapore 的。不要選要付費的 Global。
2. 後端用的是 Spring 的 Redis 協定（`StringRedisTemplate`），不是 Upstash 的 REST API。
3. 從 `rediss://default:密碼@主機:6379` 拆開來填：
   - `REDIS_HOST`：主機名稱，不含 `rediss://` 和埠
   - `REDIS_PORT`：`6379`
   - `REDIS_USERNAME`：`default`
   - `REDIS_PASSWORD`：密碼

`cloud` profile 會打開 TLS。本機的 Docker Redis 沒有密碼、也不走 TLS，所以本機不要開這個 profile。

### 3. Render（後端）

1. 把這個 Git 倉庫接到 Render，選 **New → Blueprint**，用根目錄的 `render.yaml`。
2. Blueprint 會建立 `30-lab-api`，方案 Free，區域 Singapore，健康檢查 `/actuator/health`。
3. 補上 Dashboard 裡還沒填的環境變數：

| 變數 | 值 |
|---|---|
| `MONGODB_URI` | 第 1 步的連線字串 |
| `REDIS_HOST` | Upstash 主機 |
| `REDIS_PASSWORD` | Upstash 密碼 |
| `CORS_ALLOWED_ORIGINS` | 先留空，第 4 步得到 Vercel 網址後再填 |
| `JWT_SECRET` | Blueprint 會自動產生。不要隨便換，換了舊的登入會全部失效 |

`SPRING_PROFILES_ACTIVE=cloud`、`COOKIE_SECURE=true`、`REDIS_PORT`、`REDIS_USERNAME` 已經寫在 `render.yaml`。

4. 部署完成後記下網址，例如 `https://30-lab-api.onrender.com`。打開 `/actuator/health` 應是 `{"status":"UP"}`。第一次建置要下載 Maven 和依賴，會比較久。

免費方案一個月 750 小時，一台整天開著就差不多用完。15 分鐘沒有外來請求會休眠，下次請求大約要等 1 分鐘。這個帳號不要再放第二個免費服務。

### 4. Vercel（前端）

1. Import 同一個倉庫。Root Directory 設 `frontend`，Framework 選 Next.js。
2. 建置前設環境變數，然後部署：

| 變數 | 值 |
|---|---|
| `BACKEND_URL` | `https://30-lab-api.onrender.com`（不要加 `/api`，rewrite 會自己接） |
| `NEXT_PUBLIC_WS_URL` | `wss://30-lab-api.onrender.com/ws` |

3. 得到前端網址後，回到 Render 把 `CORS_ALLOWED_ORIGINS` 設成那個網址，例如 `https://30-lab.vercel.app`（不要斜線結尾），再重新部署後端。WebSocket 握手會核對這個來源，沒設的話開獎推播接不上，頁面會退回自己輪詢。

瀏覽器的 `/api/*` 打到 Vercel，由 `next.config.ts` 的 rewrite 轉去 Render。登入 cookie 因此落在 Vercel 的網域上，`SameSite=Lax` 可以照舊，不必改成跨站 cookie。

### 5. 機器人

在自己的電腦、專案根目錄：

```powershell
$env:BASE_URL="https://30-lab-api.onrender.com"
$env:BOT_COUNT="15"
$env:QUIET="1"
node tools/bot-players/bots.mjs
```

`BASE_URL` 指 Render，不要指 Vercel。腳本每 2 秒打一次公開的期數 API，電腦和腳本都開著時，Render 就不會休眠。預設 80 個機器人整天跑會很快用完 Atlas 的 512 MB 和 Upstash 的每月指令數，展示用 15 個、只在要給人看的那幾小時開。

## 上線後會少掉的一件事

「同一個帳號在別的地方登入，這個分頁立刻被踢掉」走 WebSocket `/user/queue/session`，握手時要帶登入 cookie。cookie 在 `*.vercel.app`，WebSocket 在 `*.onrender.com`，瀏覽器不會把這顆 cookie 送過去。開獎廣播 `/topic/draws` 不認人，不受影響。被踢掉的那個分頁要等到下一次打 API、收到 `40102`，才會被導去登入頁。

要兩邊即時都正常，前後端得在同一個父網域下（自己的網域，cookie 的 Domain 設成那個父網域）。免費額度這一步先不做。
