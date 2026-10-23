"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { onWsConnect, subscribeWs } from "@/lib/ws/client";
import { fetchCurrentDraw, feedNow, removeLegacyResults, useDrawFeed, type DrawEvent } from "./feed";

const RETRY_MS = 10_000;
const WATCHDOG_MS = 5_000;
/** 過了這麼久還沒收到該有的推播，就重新抓一次 */
const LATE_MS = 5_000;

/**
 * 啟動期數資料（全站一個，放在 [locale]/layout）：
 * - 載入時抓 GET /api/draws/current，之後靠 /topic/draws 推播更新
 * - WebSocket 重連、分頁切回來時重新抓（斷線期間可能漏掉推播）
 * - 看門狗：過了開獎時間還沒收到新的一期、或新的一期開始了還沒收到上一期的號碼 → 重新抓
 * - 抓失敗每 10 秒重試；畫面依 status === "error" 顯示錯誤
 * - 收到 SETTLED（派彩已完成）→ 重新抓注單、錢包、積分紀錄、彩池、開獎紀錄
 *   （中獎結果、積分增加由畫面等開獎動畫播完才顯示，見 wallet/api.ts 的 useBalance）
 */
export function DrawFeed() {
  const queryClient = useQueryClient();

  useEffect(() => {
    removeLegacyResults();
    void useDrawFeed.persist.rehydrate();
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;

    const load = () => {
      clearTimeout(retry);
      fetchCurrentDraw()
        .then((res) => !cancelled && useDrawFeed.getState().applyCurrent(res))
        .catch(() => {
          if (cancelled) return;
          useDrawFeed.getState().setError();
          retry = setTimeout(load, RETRY_MS);
        });
    };
    load();

    const stopEvents = subscribeWs("/topic/draws", (body) => {
      const event = body as DrawEvent | null;
      if (!event?.draw?.drawNo) return;
      useDrawFeed.getState().applyEvent(event);
      if (event.type === "SETTLED") {
        for (const key of ["tickets", "wallet", "wallet-transactions", "jackpot", "draws"]) {
          void queryClient.invalidateQueries({ queryKey: [key] });
        }
      }
    });
    const stopReconnect = onWsConnect(load);
    const onVisible = () => !document.hidden && load();
    document.addEventListener("visibilitychange", onVisible);

    const watchdog = setInterval(() => {
      const { current, previous } = useDrawFeed.getState();
      if (!current) return;
      const now = feedNow();
      const missedNext = now > Date.parse(current.drawAt) + LATE_MS;
      const openAt = Date.parse(current.openAt);
      const missedResult = now > openAt + LATE_MS && (!previous || Date.parse(previous.drawAt) < openAt);
      if (missedNext || missedResult) load();
    }, WATCHDOG_MS);

    return () => {
      cancelled = true;
      clearTimeout(retry);
      clearInterval(watchdog);
      stopEvents();
      stopReconnect();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [queryClient]);

  return null;
}
