import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// 組合 className：條件 class 用 clsx，衝突的 Tailwind class 由 tailwind-merge 保留後面那個
// 例：cn("px-2", isWide && "px-4") → "px-4"
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
