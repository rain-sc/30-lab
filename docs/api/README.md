# API 契約

`openapi.json` 是前後端之間的**契約**，由後端的 springdoc 根據代碼自動生成，前端用它生成 TypeScript 類型。

## 後端：匯出契約

後端啟動後執行（在專案根目錄）：

```powershell
curl http://localhost:8088/v3/api-docs -o docs/api/openapi.json
```

匯出後記得在 [../api-changelog.md](../api-changelog.md) 記錄這次改了什麼。

## 前端：生成類型（階段 1 加入）

```powershell
cd frontend
npm run gen:api     # openapi-typescript ../docs/api/openapi.json -o src/types/api.d.ts
```

後端改了字段，前端重新生成後，用到舊字段的地方會直接出現類型錯誤，不會悄悄對不上。
