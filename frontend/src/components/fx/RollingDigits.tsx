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
          <span key={i} className="relative inline-block overflow-hidden align-top">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={char}
                className="inline-block"
                initial={{ y: "-70%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: "70%", opacity: 0 }}
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
