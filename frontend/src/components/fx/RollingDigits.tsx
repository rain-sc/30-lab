"use client";

// 數字滾動：每個數字獨立，變化時舊數字往下滑出、新數字從上方滑入（像倒數計時器翻動）
// 參考：React Bits「Counter」 https://reactbits.dev/components/counter
// 沒有直接用原版的原因：
//   1. 原版在 if 之後呼叫 useSpring，違反 hook 規則，過不了 lint
//   2. 原版用十進位循環，秒數十位數只有 0–5，換分鐘時會倒著滾 5 格
//   3. 原版字級寫死 px，這裡用 em，跟著外層字級縮放（手機、桌面不同大小）
// reduced-motion 由 MotionProvider 處理：位移動畫會被跳過，只剩淡入淡出
import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";

type RollingDigitsProps = {
  /** 要顯示的文字，例如 "04:52"；非數字字元（冒號）原樣顯示 */
  value: string;
  /** 自訂非數字字元的外觀，例如把冒號染成金色 */
  renderSeparator?: (char: string) => ReactNode;
};

export function RollingDigits({ value, renderSeparator }: RollingDigitsProps) {
  return (
    <>
      {[...value].map((char, i) =>
        /\d|-/.test(char) ? (
          // 固定寬高的裁切格：舊數字絕對定位疊在同一格。
          // inline-block 沒有高度時，iOS 不會裁切 transform；popLayout 還會把退場數字留在旁邊，看起來多一位。
          <span
            key={i}
            className="relative inline-block h-[1em] w-[1ch] overflow-hidden align-bottom leading-none [transform:translateZ(0)]"
          >
            <AnimatePresence initial={false}>
              <motion.span
                key={char}
                className="absolute inset-0 flex items-center justify-center"
                initial={{ y: "-100%" }}
                animate={{ y: "0%" }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", stiffness: 300, damping: 26 }}
              >
                {char}
              </motion.span>
            </AnimatePresence>
          </span>
        ) : (
          <span key={i}>{renderSeparator ? renderSeparator(char) : char}</span>
        ),
      )}
    </>
  );
}
