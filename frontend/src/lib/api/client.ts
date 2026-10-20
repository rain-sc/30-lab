// API 請求封裝（axios）：所有後端 API 都透過這裡的 `api` 呼叫
// - 統一處理後端的 { code, msg, data }：code = 0 回傳 data；其他丟出 ApiError（帶 5 位數業務錯誤碼，前 3 碼 = HTTP 狀態碼）
// - 逾時、連不到伺服器、回應格式不對，也統一轉成 ApiError，畫面只需要處理一種錯誤
// - 40100 / 40102 統一導向登入頁
// 瀏覽器端一律打相對路徑 /api/...，由 next.config.ts 轉發到後端（同源，HttpOnly cookie 自動帶上）
import axios, { AxiosError, type AxiosRequestConfig, type AxiosResponse } from "axios";
import { isSignedOutHere, markSignedOutHere, type SignOutReason } from "./tabSession";

/** 欄位驗證失敗（40001）時 data 的每一項 */
export type FieldViolation = { field: string; rule: string };

/** 前端自己用的錯誤碼：逾時、連不到後端、或回應不是預期的格式 */
export const NETWORK_ERROR = 0;

/** 需要登入的接口可能回傳的錯誤碼 */
export const UNAUTHORIZED = 40100;
export const SESSION_REPLACED = 40102;

/**
 * 請求逾時（毫秒）。後端重啟、卡住或停在中斷點時，沒有逾時的話請求會一直掛著，
 * 畫面就會永遠停在「載入中」（例如首頁的「確認登入狀態中…」、登入按鈕一直轉圈）。
 */
const REQUEST_TIMEOUT_MS = 10000;

export class ApiError extends Error {
  constructor(
    /** 5 位數業務錯誤碼；逾時或連線失敗是 NETWORK_ERROR */
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

// 自訂的請求選項，加在 axios 的 config 上（有型別檢查）
declare module "axios" {
  interface AxiosRequestConfig {
    /**
     * 收到 40100（未登入 / 過期）或 40102（被別處登入踢掉）時，自動導向登入頁。
     * 預設開啟；只是「查詢登入狀態」的地方（例如首頁的 GET /me）要設成 false，自己處理。
     */
    redirectOnUnauthorized?: boolean;
  }
}

type ApiResult<T = unknown> = { code: number; msg: string; data: T };

const isApiResult = (body: unknown): body is ApiResult =>
  typeof body === "object" && body !== null && typeof (body as ApiResult).code === "number";

const http = axios.create({
  baseURL: "/api",
  timeout: REQUEST_TIMEOUT_MS,
});

/** 後端回傳了業務錯誤：轉成 ApiError，需要時導向登入頁 */
function businessError(body: ApiResult, status: number, config?: AxiosRequestConfig): ApiError {
  const error = new ApiError(body.code, status, body.msg, body.data);
  if (config?.redirectOnUnauthorized !== false && (body.code === UNAUTHORIZED || body.code === SESSION_REPLACED)) {
    redirectToLogin(body.code === SESSION_REPLACED ? "replaced" : "expired");
  }
  return error;
}

/** 這個分頁已登出時，仍然可以送的請求：不用登入的接口（重新登入、註冊、目前期數：登入頁的直播面板） */
const ALLOWED_WHEN_SIGNED_OUT = ["/auth/login", "/auth/register", "/draws/current"];

// 這個分頁已登出（被其他分頁的登入取代、或被踢下線）時，擋下其他請求、不送出去：
// cookie 是共用的，送出去帶的是別的分頁的 session，後端會照常處理（等於這個分頁還能下注）。
// 擋下的請求當成 40100（未登入），呼叫端照未登入處理即可。見 tabSession.ts
http.interceptors.request.use((config) => {
  if (isSignedOutHere() && !ALLOWED_WHEN_SIGNED_OUT.includes(config.url ?? "")) {
    const body: ApiResult = { code: UNAUTHORIZED, msg: "signed out in this tab", data: null };
    throw businessError(body, 401, config);
  }
  return config;
});

http.interceptors.response.use(
  // HTTP 2xx：拆開 { code, msg, data }，之後 response.data 就是後端的 data
  (response: AxiosResponse) => {
    const body: unknown = response.data;
    if (!isApiResult(body)) throw new ApiError(NETWORK_ERROR, response.status, "unexpected response", body);
    if (body.code !== 0) throw businessError(body, response.status, response.config);
    response.data = body.data;
    return response;
  },
  // HTTP 4xx / 5xx、逾時、斷線
  (error: AxiosError | ApiError) => {
    // 請求攔截器擋下的請求（這個分頁已登出）也會流進這裡，已經是 ApiError 就直接往外丟
    if (error instanceof ApiError) throw error;
    const response = error.response;
    if (!response) {
      // 逾時（ECONNABORTED / ETIMEDOUT）或連不到伺服器
      throw new ApiError(NETWORK_ERROR, 0, error.code ?? "network error", null);
    }
    if (isApiResult(response.data)) throw businessError(response.data, response.status, error.config);
    // 回應不是後端的格式（例如後端沒開，Next 轉發回傳 HTML 錯誤頁）：用 HTTP 狀態碼的通用碼
    throw new ApiError(response.status * 100, response.status, response.statusText, null);
  },
);

/**
 * 所有後端 API 都用這個呼叫，回傳值已經是後端的 data（型別由呼叫端指定，從 @/types/api 取）。
 * 失敗一律丟 ApiError。
 * @example api.post<User>("/auth/login", { username, password })
 * @example api.get<User>("/auth/me", { redirectOnUnauthorized: false })
 */
export const api = {
  get: <T>(url: string, config?: AxiosRequestConfig) => http.get<T>(url, config).then((r) => r.data),
  delete: <T>(url: string, config?: AxiosRequestConfig) => http.delete<T>(url, config).then((r) => r.data),
  post: <T>(url: string, body?: unknown, config?: AxiosRequestConfig) => http.post<T>(url, body, config).then((r) => r.data),
  put: <T>(url: string, body?: unknown, config?: AxiosRequestConfig) => http.put<T>(url, body, config).then((r) => r.data),
  patch: <T>(url: string, body?: unknown, config?: AxiosRequestConfig) => http.patch<T>(url, body, config).then((r) => r.data),
};

let redirecting = false;

/**
 * 在這個分頁登出：記住「此分頁已登出」和原因（sessionStorage，見 tabSession.ts），導向登入頁。
 * 原因不放在網址上，登入頁的 SessionNotice 從 sessionStorage 讀
 * - 用整頁跳轉：不保留任何畫面狀態（Next 的 Activity 會保留舊頁面），WebSocket 也會隨頁面關閉
 * - **不呼叫 logout API**：cookie 是共用的，可能屬於別的分頁或新的登入，呼叫會把它也登出
 * - 只導向一次：同一件事可能同時從 API、WebSocket、其他分頁的廣播觸發
 */
export function redirectToLogin(reason: SignOutReason) {
  markSignedOutHere(reason);
  const locale = document.documentElement.lang || "zh-TW";
  // 已經在登入頁就不再跳轉（避免重新整理迴圈）
  if (redirecting || window.location.pathname === `/${locale}/login`) return;
  redirecting = true;
  // 刻意整頁跳轉而不是 router.push：要清掉所有用戶端狀態（包括被 Activity 隱藏保留的頁面）
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`/${locale}/login`);
}
