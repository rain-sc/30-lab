"use client";

import { useSyncExternalStore } from "react";

/**
 * CSS media query 目前是否成立；伺服器端和 hydrate 前是 null（不知道螢幕大小）。
 * 用在「只能掛一個」的東西（例如 WebGL 場景）：CSS 的 hidden 只是藏起來，元件還是會掛載
 */
export function useMediaQuery(query: string): boolean | null {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => null,
  );
}

/** 和 Tailwind 的 md 斷點一致 */
export const useIsDesktop = () => useMediaQuery("(min-width: 768px)");
