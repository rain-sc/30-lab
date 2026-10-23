"use client";

import { useFormatter } from "next-intl";
import { useSyncExternalStore } from "react";

// 伺服器（Vercel）在 UTC。next-intl 沒指定時區時會把 UTC 傳給瀏覽器，
// 開獎時間就會顯示成 11:40 而不是當地的 19:40。
// 時區只能在瀏覽器讀到：伺服器渲染先留白，掛載後再用當地時區格式化，避免 hydration 不一致。
const subscribe = () => () => {};
const localTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

function useLocalTimeZone() {
  return useSyncExternalStore(subscribe, localTimeZone, () => null);
}

type DateTimeOptions = NonNullable<Parameters<ReturnType<typeof useFormatter>["dateTime"]>[1]>;

/** 把 ISO 時間格式化成瀏覽器所在的時區。語系仍用頁面的 zh-TW / en。 */
export function LocalTime({
  value,
  className,
  ...options
}: { value: string | number | Date; className?: string } & Omit<DateTimeOptions, "timeZone">) {
  const format = useFormatter();
  const timeZone = useLocalTimeZone();
  const date = new Date(value);
  return (
    <time dateTime={date.toISOString()} className={className}>
      {timeZone ? format.dateTime(date, { ...options, timeZone }) : "\u00a0"}
    </time>
  );
}
