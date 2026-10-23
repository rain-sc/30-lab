# 30 Lab — 前端

30 Lab 的網頁：用虛擬積分玩的選號開獎遊戲（從 1–30 選 6 個號碼）。Next.js 16（App Router）· React 19 · TypeScript · Tailwind CSS 4。

專案整體說明見 [../README.md](../README.md)，前端的開發約定見 [CLAUDE.md](CLAUDE.md)。

## 啟動

需要後端（http://localhost:8088）和 MongoDB、Redis 已經啟動，見根目錄的 README。

```bash
npm install
npm run dev       # http://localhost:3100
```

## 常用命令

```bash
npm run dev       # 開發伺服器（埠 3100；/api/* 轉發到後端）
npm run build     # 正式建置
npm run lint      # ESLint
npm run gen:api   # 從 ../docs/api/openapi.json 重新產生 API 型別（src/types/api.d.ts）
```
