import { apiRequest } from "@/lib/api/client";
import type { components } from "@/types/api";

export type User = components["schemas"]["UserResponse"];
type LoginBody = components["schemas"]["LoginRequest"];
type RegisterBody = components["schemas"]["RegisterRequest"];

// 登入狀態是後端設的 HttpOnly cookie（msl_token），前端 JS 不會碰到 token

/** 登入；失敗：40101 帳號或密碼錯誤、40001 欄位格式 */
export function login(body: LoginBody) {
  return apiRequest<User>("/auth/login", { method: "POST", body });
}

/** 註冊，成功後直接登入；失敗：40901 帳號已被使用、40001 欄位格式 */
export function register(body: RegisterBody) {
  return apiRequest<User>("/auth/register", { method: "POST", body });
}

/** 目前登入的使用者；未登入 40100、被別處登入踢掉 40102。只查狀態，不自動導向登入頁 */
export function fetchMe() {
  return apiRequest<User>("/auth/me", { redirectOnUnauthorized: false });
}

/** 登出（一律成功，清掉 cookie） */
export function logout() {
  return apiRequest<null>("/auth/logout", { method: "POST" });
}
