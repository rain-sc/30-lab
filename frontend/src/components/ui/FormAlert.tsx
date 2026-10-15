import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type FormAlertProps = {
  children: ReactNode;
  /** error：送出失敗（紅）；info：一般提示（例如被別處登入後回到登入頁） */
  tone?: "error" | "info";
  className?: string;
};

// 表單層級的訊息：不屬於單一欄位的錯誤（帳號或密碼錯誤、系統繁忙…）或提示
// role="alert"：出現時螢幕閱讀器會立刻讀出
export function FormAlert({ children, tone = "error", className }: FormAlertProps) {
  return (
    <p
      role="alert"
      className={cn(
        "m-0 rounded-control border px-3 py-2.5 text-sm",
        tone === "error" ? "border-danger/50 bg-danger/10 text-danger" : "border-gold/40 bg-gold/10 text-gold",
        className,
      )}
    >
      {children}
    </p>
  );
}
