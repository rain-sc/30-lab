"use client";

import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/features/auth/session";
import { fetchDraws, MAX_PAGE_SIZE } from "@/features/draw/api";
import { useDrawFeed, type Draw } from "@/features/draw/feed";
import { revealedAt } from "@/features/draw/stage/timeline";
import { useNow } from "@/features/draw/useNextDraw";
import { useUserBets } from "./mockBets";

/** 往回最多查幾頁（100 期一頁，約 8 小時） */
const MAX_PAGES = 10;

/**
 * 補查「待確認」注單的開獎號碼：開獎時不在線上，前端沒收到推播的期數，
 * 用開獎紀錄（GET /api/draws）往回查，查到的號碼記進 feed 的 results，查不到的標成 missing。
 * 放在遊戲端版面（不顯示任何東西）。
 */
export function ResultBackfill() {
  const user = useSession((s) => s.user);
  const bets = useUserBets(user?.username);
  const results = useDrawFeed((s) => s.results);
  const missingMarked = useDrawFeed((s) => s.missing);
  const addResults = useDrawFeed((s) => s.addResults);
  const setMissing = useDrawFeed((s) => s.setMissing);
  const now = useNow();

  // 動畫已經播完、還沒有號碼、也還沒查過的期數
  const wanted = useMemo(() => {
    if (now === null) return [];
    const byNo = new Map<string, number>();
    for (const b of bets) {
      if (revealedAt(b.drawAt) <= now && !results[b.drawNo] && !missingMarked[b.drawNo]) byNo.set(b.drawNo, b.drawAt);
    }
    return [...byNo.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [bets, results, missingMarked, now]);

  const query = useQuery({
    queryKey: ["draws-backfill", wanted.map(([no]) => no).join(",")],
    enabled: wanted.length > 0,
    staleTime: Infinity,
    queryFn: async () => {
      const oldest = Math.min(...wanted.map(([, drawAt]) => drawAt));
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
    // 開獎紀錄裡沒有這期（例如後端停機期間），不再重查
    const notFound = wanted.map(([no]) => no).filter((no) => !got.has(no));
    if (notFound.length > 0) setMissing(notFound);
  }, [query.data, wanted, addResults, setMissing]);

  return null;
}
