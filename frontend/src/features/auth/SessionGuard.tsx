"use client";

import { useEffect } from "react";
import { redirectToLogin } from "@/lib/api/client";
import { isSignedOutHere, markSignedOutHere, onOtherTabSignedIn } from "@/lib/api/tabSession";
import { startWs, stopWs, subscribeWs } from "@/lib/ws/client";
import { isSigningIn } from "./api";

/** 後端推到 /user/queue/session 的帳號事件 */
type SessionEvent = { type: "SESSION_REPLACED" };

/**
 * 收到 SESSION_REPLACED 後等多久才導向登入頁。
 * 同一個瀏覽器的另一個分頁登入同一個帳號時，推播和分頁廣播都會來，推播通常先到；
 * 先等一下，讓分頁廣播有機會先處理，提示才會是「另一個分頁登入了」，而不是嚇人的「其他地方登入了」。
 */
const REPLACED_DELAY_MS = 500;

const isLoginPage = () => /^\/[^/]+\/login$/.test(window.location.pathname);

/** 這個分頁登出：停在登入頁的只記下、斷開 WebSocket；其他頁面導向登入頁（整頁跳轉，WebSocket 隨頁面關閉） */
function signOutHere(reason: "other-tab" | "replaced") {
  if (isLoginPage()) {
    markSignedOutHere();
    stopWs();
  } else {
    redirectToLogin(reason);
  }
}

/**
 * 全站常駐，處理「這個分頁被登出」的兩種通知（規則見 lib/api/tabSession.ts）：
 * 一、同一個瀏覽器的其他分頁登入了（BroadcastChannel）→ 這個分頁登出，/login?reason=other-tab
 * 二、同一個帳號在別處登入、這個 session 被取代（WebSocket /user/queue/session）→ 這個分頁登出，/login?reason=replaced
 *     （這個分頁自己正在登入時收到的忽略：推播比登入回應早到，它自己就是新的登入者）
 * 第三種是 API 回傳 40100 / 40102，由 client.ts 的攔截器處理。
 * 已登出的分頁不連 WebSocket、不處理通知；重新登入後 api.ts 會 restartWs 開始連線。
 * 只在畫面上登出，不呼叫 logout API（cookie 屬於新登入的那一邊）。
 * 放在 [locale]/layout，換頁不會重新掛載。
 */
export function SessionGuard() {
  useEffect(() => {
    if (!isSignedOutHere()) startWs();

    const stopWatchingTabs = onOtherTabSignedIn(() => {
      if (!isSignedOutHere()) signOutHere("other-tab");
    });

    const stopWatchingSession = subscribeWs("/user/queue/session", (body) => {
      if ((body as SessionEvent | null)?.type !== "SESSION_REPLACED") return;
      if (isSigningIn() || isSignedOutHere()) return;
      setTimeout(() => {
        if (!isSignedOutHere()) signOutHere("replaced");
      }, REPLACED_DELAY_MS);
    });

    return () => {
      stopWatchingTabs();
      stopWatchingSession();
    };
  }, []);

  return null;
}
