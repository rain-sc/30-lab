"use client";

// 倒數用的數字滾動：每一位數是一條「數字帶」，變化時整條往下滑，新數字從上方進來（像翻動的計時器）
// 參考：React Bits「Counter」 https://reactbits.dev/components/counter
//
// 做法：純 CSS 的里程表，不用 Motion 的 AnimatePresence
// - 以前用 AnimatePresence（舊數字退場、新數字進場），切到別的頁面（Next 的 <Activity> 把頁面設成 display: none）
//   或分頁在背景（瀏覽器降低動畫更新）時，退場動畫會卡在一半，舊數字疊在新數字上
// - 現在畫面上永遠只有一條數字帶，位置由目前的數字決定（transform），動畫被打斷也一定停在正確的位置
// - 倒數時數字變大 = 進位（例如秒數十位 0 → 5、個位 0 → 9）：數字帶上方多一格放新數字，先往下滾一格到那格，
//   滾完再瞬間跳回同一個數字在帶子裡的位置，不會倒著滾好幾格；就算 transitionend 沒觸發（頁面被藏起來），那一格顯示的也是正確的數字
// - 字級用 em，跟著外層字級縮放；寬度由看不見的同一個字撐開（不用 1ch：iOS Safari 量到的 ch 比粗體數字窄）
// - reduced-motion：不滑動，直接換
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type RollingDigitsProps = {
  /** 要顯示的文字，例如 "04:52"；數字以外的字元（冒號、還沒有資料時的 "-"）原樣顯示 */
  value: string;
  /** 自訂非數字字元的外觀，例如把冒號染成金色 */
  renderSeparator?: (char: string) => ReactNode;
};

export function RollingDigits({ value, renderSeparator }: RollingDigitsProps) {
  return (
    <>
      {[...value].map((char, i) =>
        /\d/.test(char) ? (
          <Digit key={i} digit={Number(char)} />
        ) : (
          <span key={i}>{renderSeparator ? renderSeparator(char) : char}</span>
        ),
      )}
    </>
  );
}

/** 數字帶的格數：最上面一格是「進位用」，下面是 0–9 */
const CELLS = 11;

function Digit({ digit }: { digit: number }) {
  // 數字改變時在 render 裡調整狀態（React 建議的「依 props 調整 state」寫法，不用 effect）
  const [prev, setPrev] = useState(digit);
  /** 進位中：數字帶停在最上面那格（顯示 carry），滾完再跳回 digit 的位置 */
  const [carry, setCarry] = useState<number | null>(null);
  /** 跳回正確位置的那一刻不要有過場 */
  const [snapping, setSnapping] = useState(false);
  if (digit !== prev) {
    const wrap = digit > prev;
    setPrev(digit);
    // 進位還沒滾完（頁面被藏起來時 transitionend 不會觸發）又換了數字：直接跳到新位置，不滾
    setSnapping(carry !== null && !wrap);
    setCarry(wrap ? digit : null);
  }

  // 跳完等兩幀再恢復過場：確定瀏覽器已經用「沒有過場」的樣式畫過一次，不然會從舊位置滾過去
  useEffect(() => {
    if (!snapping) return;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setSnapping(false));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [snapping]);

  const index = carry !== null ? 0 : digit + 1;
  const onTransitionEnd = () => {
    if (carry === null) return;
    setSnapping(true);
    setCarry(null);
  };

  return (
    <span className="relative inline-block overflow-hidden align-top">
      {/* 撐開寬高：看不見的同一個字 */}
      <span aria-hidden="true" className="invisible">
        {digit}
      </span>
      <span
        aria-hidden="true"
        onTransitionEnd={onTransitionEnd}
        className={cn(
          "absolute inset-x-0 top-0 flex flex-col text-center",
          !snapping && "transition-transform duration-500 ease-[cubic-bezier(0.22,1.2,0.36,1)] motion-reduce:transition-none",
        )}
        style={{ height: `${CELLS * 100}%`, transform: `translateY(-${(index * 100) / CELLS}%)` }}
      >
        <span className="flex-1">{carry ?? digit}</span>
        {Array.from({ length: 10 }, (_, n) => (
          <span key={n} className="flex-1">
            {n}
          </span>
        ))}
      </span>
      {/* 螢幕閱讀器讀目前的數字（數字帶整條藏起來） */}
      <span className="sr-only">{digit}</span>
    </span>
  );
}
