"use client";

// 目前登入的使用者（遊戲頁面共用：頁首的暱稱、積分，注單依帳號分開）
// 由 GameSessionGate 打 GET /auth/me 填入；登出時清掉
import { create } from "zustand";
import type { User } from "./api";

type SessionState = {
  user: User | null;
  setUser: (user: User | null) => void;
};

export const useSession = create<SessionState>()((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}));
