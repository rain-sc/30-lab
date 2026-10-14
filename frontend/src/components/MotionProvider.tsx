"use client";

import type { ReactNode } from "react";
import { MotionConfig } from "motion/react";

// 全站的 Motion 設定：使用者開啟「減少動態效果」時，Motion 自動跳過位移、縮放動畫（透明度照常）
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
