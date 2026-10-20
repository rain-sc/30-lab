"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Ball } from "@/components/Ball";
import { PICK_COUNT, useBetting } from "@/features/betting/store";
import { useDrawFeed } from "./feed";
import { sampleHotCold } from "./mock";
import type { NextDraw } from "./useNextDraw";

const WINDOW = 100;

/** 冷熱號碼的計算結果（選號盤也用來標示熱門號碼） */
export function useHotCold(next: NextDraw | null) {
  const revealedDrawAt = next?.revealedDrawAt;
  const results = useDrawFeed((s) => s.results);
  return useMemo(
    () => (revealedDrawAt ? sampleHotCold(revealedDrawAt, results, WINDOW) : null),
    [revealedDrawAt, results],
  );
}

/** 冷熱號碼：最近 100 期最常開出、最久沒開的號碼；點號碼加入選號盤 */
export function HotCold({ next }: { next: NextDraw | null }) {
  const t = useTranslations("HotCold");
  const data = useHotCold(next);
  const add = useBetting((s) => s.add);
  const picked = useBetting((s) => s.picked);
  const [message, setMessage] = useState("");

  const pick = (n: number) => {
    if (picked.includes(n)) setMessage(t("already", { number: n }));
    else if (picked.length >= PICK_COUNT) setMessage(t("full"));
    else {
      add(n);
      setMessage(t("added", { number: n, count: picked.length + 1, total: PICK_COUNT }));
    }
  };

  const group = (title: string, items: { number: number; label: string; aria: string }[], dot: boolean) => (
    <div className="flex flex-col gap-2.5">
      <h3 className="m-0 flex items-center gap-1.5 text-[13px] font-normal text-fg-soft">
        {dot && <span aria-hidden="true" className="size-1.5 rounded-full bg-gold" />}
        {title}
      </h3>
      <ul className="m-0 flex list-none flex-wrap gap-3 p-0">
        {items.map((item) => (
          <li key={item.number}>
            <button
              type="button"
              aria-label={item.aria}
              aria-pressed={picked.includes(item.number)}
              onClick={() => pick(item.number)}
              className="group flex flex-col items-center gap-1 rounded-control p-1 text-xs text-muted focus-visible:outline-2 focus-visible:outline-gold"
            >
              <Ball
                number={item.number}
                size="sm"
                className="size-9 text-base transition-transform group-hover:-translate-y-0.5 group-aria-pressed:ring-2 group-aria-pressed:ring-gold"
              />
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      {data ? (
        <div className="flex flex-wrap gap-x-12 gap-y-5">
          {group(
            t("hot"),
            data.hot.map((h) => ({
              number: h.number,
              label: t("times", { count: h.count }),
              aria: t("hotAria", { number: h.number, count: h.count }),
            })),
            true,
          )}
          {group(
            t("cold"),
            data.cold.map((c) => ({
              number: c.number,
              label: t("missed", { count: c.missed }),
              aria: t("coldAria", { number: c.number, count: c.missed }),
            })),
            false,
          )}
        </div>
      ) : (
        <div aria-hidden="true" className="h-20" />
      )}
      <p aria-live="polite" className="m-0 min-h-5 text-[13px] text-gold">
        {message}
      </p>
    </div>
  );
}
