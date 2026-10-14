# API 變更記錄（前後端交接）

前端、後端在不同對話裡開發，這份文件是兩邊的**交接記錄**。

- **後端**：每次新增、修改、刪除 API，在最上面加一筆，並重新匯出 `docs/api/openapi.json`。
- **前端**：每次開始工作先看這裡，然後重新生成類型。
- 需要對方配合的事，標註 **【待前端】** 或 **【待後端】**，完成後改成 **【已完成】**。

格式：

```
## YYYY-MM-DD
- 【新增 / 修改 / 刪除】METHOD /api/xxx：說明
  - 前端要做什麼：……
```

---

## 2026-10-14
- 【待後端】開獎動畫方案已確定，設計期數相關 API 時請參考 [draw-animation.md](draw-animation.md) 的「後端需要配合」：
  - `closeAt`、`drawAt` 時間點；`numbers` 保留開出順序（不排序）
  - 期數回應帶 `serverTime`（毫秒精度），用來校正時鐘
  - 「取得目前期數」接口；WebSocket 推送 `CLOSED`、`DRAWN`
  - 前端要做什麼：後端 API 出來後，按契約接上開獎舞台

## 2026-10-14
- 專案建立，尚無業務 API。
- 已有：`GET /actuator/health`（健康檢查）、`GET /v3/api-docs`（OpenAPI 契約）。
