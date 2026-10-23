# 30 Lab

一個用**虛擬積分**遊玩的選號開獎模擬遊戲（從 1–30 選 6 個號碼），作為全端開發的學習與作品專案。**不涉及真錢**，積分不能購買、兌換或轉讓，與任何官方彩票無關。

> 玩法參考香港六合彩的選號規則，號碼改成 1–30、獎金重新設計。「六合彩」「Mark Six」為香港賽馬會的商標，本專案與其沒有任何關係，也未獲其授權或認可。

- 每 5 分鐘自動開獎一期，開獎前 15 秒停止下注
- 選號（單式 / 機選）、即時開獎動畫、自動結算派彩
- 響應式網頁，手機、平板、桌面都能玩

## 技術棧

| 部分 | 技術 |
|---|---|
| 前端 | Next.js 16（App Router）· React 19 · TypeScript · Tailwind CSS 4 |
| 後端 | Java 21 · Spring Boot 4.1 · Spring Data MongoDB · Spring Data Redis · WebSocket（STOMP） |
| 資料 | MongoDB 8（副本集，支援事務）· Redis 7 |
| 工程 | Docker Compose · OpenAPI（springdoc）· GitHub Actions（規劃中） |

## 專案結構

```
30-lab/
├── backend/            Spring Boot API（埠 8088）
├── frontend/           Next.js 網頁（埠 3100）
├── docs/               遊戲規則、資料模型、狀態機、API 契約
└── docker-compose.yml  MongoDB + Redis
```

## 本機啟動

需要：Java 21、Node.js 22、Docker Desktop。

```bash
# 1. 啟動 MongoDB（單節點副本集，埠 27018）和 Redis（埠 6380）
docker compose up -d

# 2. 啟動後端 → http://localhost:8088/swagger-ui.html
cd backend && ./mvnw spring-boot:run

# 3. 啟動前端 → http://localhost:3100
cd frontend && npm install && npm run dev
```

## 開發路線

| 階段 | 內容 | 狀態 |
|---|---|---|
| 0 | 規劃：規則、資料模型、狀態機、API 設計 | 進行中 |
| 1 | MVP：帳戶、積分、單式投注、自動開獎、結算 | |
| 2 | 體驗：即時推送、開獎動畫、簽到、統計、排行榜 | |
| 3 | 後台：管理、儀表板、權限、審計 | |
| 4 | 進階：複式、膽拖、可驗證公平、事件驅動 | |
| 5 | 工程化：測試、CI/CD、部署、監控 | |

詳細設計見 [docs/](docs/)。
