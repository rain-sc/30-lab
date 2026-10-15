import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import type { ApiError } from "@/lib/api/client";
import type { AuthErrorKey } from "./schemas";

/**
 * 把後端的欄位錯誤（40001）顯示在對應的欄位下。
 * 回傳 true 表示每個錯誤都對應到欄位了；有對應不到的就回傳 false，由呼叫端顯示在表單上方。
 */
export function applyFieldViolations<T extends FieldValues>(
  error: ApiError,
  setError: UseFormSetError<T>,
  map: Record<string, Record<string, AuthErrorKey>>,
): boolean {
  const violations = error.fieldViolations;
  if (violations.length === 0) return false;

  let allMapped = true;
  violations.forEach(({ field, rule }, i) => {
    const key = map[field]?.[rule];
    if (!key) {
      allMapped = false;
      return;
    }
    // 第一個錯誤的欄位取得焦點，方便直接修改
    setError(field as Path<T>, { type: "server", message: key }, { shouldFocus: i === 0 });
  });
  return allMapped;
}
