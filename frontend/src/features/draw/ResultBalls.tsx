import { useTranslations } from "next-intl";
import { Ball } from "@/components/Ball";
import { cn } from "@/lib/utils";

/** 一期的開獎號碼：6 個正碼 + 特別號碼 */
export type DrawResult = { numbers: number[]; special: number };

type ResultBallsProps = {
  result: DrawResult;
  /** xs：列表裡的小球；sm / md 對應 Ball 的尺寸 */
  size?: "xs" | "sm" | "md";
  className?: string;
};

const SIZE_CLASS = {
  xs: "size-6.5 text-[13px] shadow-none",
  sm: "",
  md: "",
} as const;

/** 一期的開獎號碼：6 個正碼（由小到大）+ 特別號碼 */
export function ResultBalls({ result, size = "sm", className }: ResultBallsProps) {
  const t = useTranslations("Live");
  const ballSize = size === "md" ? "md" : "sm";

  return (
    <div className={cn("flex items-center", size === "xs" ? "gap-1" : "gap-1.5", className)}>
      {[...result.numbers]
        .sort((a, b) => a - b)
        .map((n) => (
          <Ball key={n} number={n} size={ballSize} className={SIZE_CLASS[size]} />
        ))}
      <span aria-hidden="true" className="px-0.5 font-bold text-muted">
        +
      </span>
      <span className="sr-only">{t("special")}</span>
      <Ball number={result.special} size={ballSize} special className={SIZE_CLASS[size]} />
    </div>
  );
}
