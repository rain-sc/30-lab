"use client";

import { useEffect, useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { fetchDraws } from "./api";
import { useDrawFeed } from "./feed";
import type { NextDraw } from "./useNextDraw";

/**
 * 開獎紀錄（GET /api/draws），由新到舊。
 * - 只列出「已公布」的期數（開獎動畫播完，見 NextDraw.revealedDrawAt），不會比舞台先劇透
 * - queryKey 帶 revealedDrawAt：新的一期公布時自動重抓
 * - 拿到的號碼也記進 feed 的 results（示例注單對獎用）
 */
export function useDrawHistory(page: number, size: number, next: NextDraw | null) {
  const revealedDrawAt = next?.revealedDrawAt ?? null;
  const addResults = useDrawFeed((s) => s.addResults);
  const query = useQuery({
    queryKey: ["draws", page, size, revealedDrawAt],
    queryFn: () => fetchDraws(page, size),
    enabled: revealedDrawAt !== null,
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (query.data) addResults(query.data.list);
  }, [query.data, addResults]);

  const list = useMemo(
    () => query.data?.list.filter((d) => revealedDrawAt !== null && Date.parse(d.drawAt) <= revealedDrawAt) ?? [],
    [query.data, revealedDrawAt],
  );
  return { ...query, list };
}
