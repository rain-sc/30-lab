import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type ButtonProps = ComponentProps<"button"> & {
  variant?: "primary" | "ghost";
  loading?: boolean;
};

const VARIANT_CLASS = {
  // hover 時一道光澤從左掃到右（參考 Uiverse 的 shine button），reduced-motion 時不顯示
  primary:
    "relative overflow-hidden bg-gold text-gold-ink hover:bg-gold-bright font-bold " +
    "before:pointer-events-none before:absolute before:inset-y-0 before:left-0 before:w-1/3 before:-translate-x-full before:skew-x-[-20deg] " +
    "before:bg-linear-to-r before:from-transparent before:via-white/50 before:to-transparent " +
    "before:transition-transform before:duration-700 hover:before:translate-x-[350%] motion-reduce:before:hidden",
  ghost: "border border-line bg-panel text-fg hover:border-muted",
} as const;

export function Button({
  variant = "primary",
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex h-12.5 items-center justify-center gap-2 rounded-button px-5 text-[17px] transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold",
        "disabled:cursor-not-allowed disabled:opacity-60",
        VARIANT_CLASS[variant],
        className,
      )}
      {...props}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
        />
      )}
      {children}
    </button>
  );
}
