import { ballColor, type BallColor } from "@/lib/ball";
import { cn } from "@/lib/utils";

const COLOR_CLASS: Record<BallColor, string> = {
  red: "bg-ball-red",
  blue: "bg-ball-blue",
  green: "bg-ball-green",
};

const SIZE_CLASS = {
  sm: "size-8 text-[15px]",
  md: "size-11 text-xl",
  lg: "size-14 text-2xl",
} as const;

type BallProps = {
  number: number;
  size?: keyof typeof SIZE_CLASS;
  /** 特別號碼：外圍加一圈金色 */
  special?: boolean;
  className?: string;
};

// 號碼球（DOM 版）：選號盤、注單、結果列共用，外觀要和 3D 舞台的球一致
export function Ball({ number, size = "md", special = false, className }: BallProps) {
  return (
    <span
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full font-num font-bold text-white tabular-nums",
        // 左上高光 + 右下陰影，讓平面的圓看起來像球
        "shadow-[inset_-4px_-5px_8px_rgba(0,0,0,.35),inset_3px_4px_6px_rgba(255,255,255,.25)]",
        special && "ring-2 ring-gold",
        COLOR_CLASS[ballColor(number)],
        SIZE_CLASS[size],
        className,
      )}
    >
      {number}
    </span>
  );
}
