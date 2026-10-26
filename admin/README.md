# 30 Lab — 後台前端

30 Lab 的管理後台。Vite + Vue 3 + TypeScript + Element Plus + vue-i18n + Pinia + Vue Router + axios。

設計見 [../docs/admin.md](../docs/admin.md)，開發約定見 [CLAUDE.md](CLAUDE.md)。

## 啟動

需要後端（http://localhost:8088）和 MongoDB、Redis 已經啟動，見根目錄的 README。

```bash
npm install
npm run dev       # http://localhost:3200（/api 轉發到後端 8088）
```

## 常用命令

```bash
npm run dev       # 開發伺服器（埠 3200）
npm run build     # 型別檢查 + 正式建置
npm run preview   # 預覽建置結果（埠 3200）
npm run gen:api   # 從 ../docs/api/openapi.json 重新產生 API 型別（src/types/api.d.ts）
```
