// API 請求封裝：統一處理後端的 { code, msg, data }
// - code = 0：回傳 data
// - 其他：丟出 ApiError（帶 5 位數業務錯誤碼，前 3 碼 = HTTP 狀態碼），由畫面依 code 翻譯
// 瀏覽器端一律打相對路徑 /api/...，由 next.config.ts 轉發到後端（同源，HttpOnly cookie 自動帶上）

/** 欄位驗證失敗（40001）時 data 的每一項 */
export type FieldViolation = { field: string; rule: string };

/** 前端自己用的錯誤碼：連不到後端、或回應不是預期的格式 */
export const NETWORK_ERROR = 0;

/** 需要登入的接口可能回傳的錯誤碼 */
export const UNAUTHORIZED = 40100;
export const SESSION_REPLACED = 40102;

export class ApiError extends Error {
  constructor(
    /** 5 位數業務錯誤碼；連線失敗是 NETWORK_ERROR */
    readonly code: number,
    readonly status: number,
    /** 後端的中文說明，給開發看，不直接顯示給使用者 */
    readonly backendMsg: string,
    readonly data: unknown,
  ) {
    super(`[${code}] ${backendMsg}`);
    this.name = "ApiError";
  }

  /** 欄位錯誤（40001）的清單；其他錯誤回傳空陣列 */
  get fieldViolations(): FieldViolation[] {
    return this.code === 40001 && Array.isArray(this.data) ? (this.data as FieldViolation[]) : [];
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /**
   * 收到 40100（未登入 / 過期）或 40102（被別處登入踢掉）時，自動導向登入頁。
   * 預設開啟；只是「查詢登入狀態」的地方（例如首頁的 GET /me）要關掉，自己處理。
   */
  redirectOnUnauthorized?: boolean;
};

type ApiResult<T> = { code: number; msg: string; data: T };

export async function apiRequest<T>(path: `/${string}`, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, redirectOnUnauthorized = true } = options;

  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(NETWORK_ERROR, 0, "network error", null);
  }

  let json: ApiResult<T> | null = null;
  try {
    json = (await res.json()) as ApiResult<T>;
  } catch {
    // 回應不是 JSON（例如後端沒開，Next 轉發回傳 HTML 錯誤頁）
  }
  if (!json || typeof json.code !== "number") {
    throw new ApiError(res.ok ? NETWORK_ERROR : res.status * 100, res.status, res.statusText, null);
  }

  if (json.code !== 0) {
    const error = new ApiError(json.code, res.status, json.msg, json.data);
    if (redirectOnUnauthorized && (json.code === UNAUTHORIZED || json.code === SESSION_REPLACED)) {
      redirectToLogin(json.code);
    }
    throw error;
  }
  return json.data;
}

/**
 * 導向登入頁並帶上原因，登入頁會顯示提示（例如「帳號已在其他地方登入」）。
 * 用整頁跳轉：登入狀態已失效，不保留任何畫面狀態（Next 的 Activity 會保留舊頁面）。
 */
function redirectToLogin(code: number) {
  const locale = document.documentElement.lang || "zh-TW";
  const reason = code === SESSION_REPLACED ? "replaced" : "expired";
  // 刻意整頁跳轉而不是 router.push：要清掉所有用戶端狀態（包括被 Activity 隱藏保留的頁面）
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`/${locale}/login?reason=${reason}`);
}
