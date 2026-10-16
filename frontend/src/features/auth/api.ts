import { api } from "@/lib/api/client";
import { announceSignedIn, clearSignedOutHere } from "@/lib/api/tabSession";
import { restartWs } from "@/lib/ws/client";
import type { components } from "@/types/api";

export type User = components["schemas"]["UserResponse"];
type LoginBody = components["schemas"]["LoginRequest"];
type RegisterBody = components["schemas"]["RegisterRequest"];

// 登入狀態是後端設的 HttpOnly cookie（msl_token），前端 JS 不會碰到 token。
// 同一個瀏覽器裡最後登入的分頁才能使用帳號：登入成功時通知其他分頁，它們會變成登出（見 lib/api/tabSession.ts）。
// 登入、註冊、登出後 cookie 改變，WebSocket 要重新握手，後端才會用新的身分推播。

/**
 * 這個分頁是否正在登入或註冊。
 * 後端在處理登入請求時就會推 SESSION_REPLACED 給同帳號的舊 session，比登入回應（新 cookie）早到；
 * 如果這個分頁原本就是那個舊 session，它自己就是新的登入者，這段期間的推播要忽略（見 SessionGuard）。
 */
let signingIn = 0;
export const isSigningIn = () => signingIn > 0;

async function signIn(request: () => Promise<User>) {
  signingIn++;
  try {
    const user = await request();
    // 這個分頁成為使用中的分頁：清掉「已登出」、通知其他分頁、WebSocket 用新 cookie 重新握手
    clearSignedOutHere();
    announceSignedIn();
    void restartWs();
    return user;
  } finally {
    signingIn--;
  }
}

/** 登入；失敗：40101 帳號或密碼錯誤、40001 欄位格式 */
export function login(body: LoginBody) {
  return signIn(() => api.post<User>("/auth/login", body));
}

/** 註冊，成功後直接登入；失敗：40901 帳號已被使用、40001 欄位格式 */
export function register(body: RegisterBody) {
  return signIn(() => api.post<User>("/auth/register", body));
}

/**
 * 目前登入的使用者；未登入 40100、被別處登入踢掉 40102。只查狀態，不自動導向登入頁。
 * 這個分頁已登出時不會送出，直接當成 40100（見 client.ts 的請求攔截器）
 */
export function fetchMe() {
  return api.get<User>("/auth/me", { redirectOnUnauthorized: false });
}

/** 登出（一律成功，清掉 cookie）。只有使用者自己按「登出」才呼叫；被其他分頁或裝置取代時不要呼叫 */
export async function logout() {
  await api.post<null>("/auth/logout");
  void restartWs();
}
