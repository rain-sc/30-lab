import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

type InputProps = ComponentProps<"input"> & {
  /** 輸入框右側的附加元素，例如顯示密碼的按鈕 */
  trailing?: ReactNode;
};

export function Input({ className, trailing, ...props }: InputProps) {
  return (
    <div
      className={cn(
        "flex items-center rounded-control border border-line-strong bg-sunken transition-colors",
        "focus-within:border-gold focus-within:ring-2 focus-within:ring-gold/30",
        "has-[input[aria-invalid=true]]:border-danger",
        className,
      )}
    >
      <input
        className="h-11.5 w-full min-w-0 rounded-control bg-transparent px-3.5 text-base text-fg placeholder:text-muted/60 focus:outline-none"
        {...props}
      />
      {trailing}
    </div>
  );
}
