"use client";

import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchDraws, MAX_PAGE_SIZE } from "./api";
import { useDrawFeed, type Draw } from "./feed";
import { drawAtOf } from "./schedule";
import { revealedAt } from "./stage/timeline";
import { useNow } from "./useNextDraw";

/** 往回最多查幾頁（100 期一頁，約 8 小時） */
const MAX_PAGES = 10;

/**
 * 補查開獎號碼：畫面上要顯示的期數（例如我的注單這一頁），開獎動畫已經播完、前端卻沒有號碼的
 * （開獎時不在線上、沒收到推播），用開獎紀錄（GET /api/draws）往回查，查到的記進 feed 的 results；
 * 查不到的（後端停機期間沒有這期）標成 missing，不再重查。
 */
export function useResultBackfill(drawNos: string[]) {
  const results = useDrawFeed((s) => s.results);
  const missing = useDrawFeed((s) => s.missing);
  const addResults = useDrawFeed((s) => s.addResults);
  const setMissing = useDrawFeed((s) => s.setMissing);
  const now = useNow();

  const wanted = useMemo(() => {
    if (now === null) return [];
    const set = new Set(drawNos.filter((no) => revealedAt(drawAtOf(no)) <= now && !results[no] && !missing[no]));
    return [...set].sort();
  }, [drawNos, results, missing, now]);

  const query = useQuery({
    queryKey: ["draws-backfill", wanted.join(",")],
    enabled: wanted.length > 0,
    staleTime: Infinity,
    queryFn: async () => {
      const oldest = Math.min(...wanted.map(drawAtOf));
      const found: Draw[] = [];
      for (let page = 1; page <= MAX_PAGES; page++) {
        const res = await fetchDraws(page, MAX_PAGE_SIZE);
        found.push(...res.list);
        const last = res.list.at(-1);
        if (!last || Date.parse(last.drawAt) <= oldest || page * MAX_PAGE_SIZE >= res.total) break;
      }
      return found;
    },
  });

  useEffect(() => {
    if (!query.data) return;
    addResults(query.data);
    const got = new Set(query.data.map((d) => d.drawNo));
    const notFound = wanted.filter((no) => !got.has(no));
    if (notFound.length > 0) setMissing(notFound);
  }, [query.data, wanted, addResults, setMissing]);
}
