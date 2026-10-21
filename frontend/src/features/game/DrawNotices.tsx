"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { CountUp } from "@/components/fx/CountUp";
import { useSession } from "@/features/auth/session";
import { TIERS, useRecentTickets, type Ticket, type Tier } from "@/features/betting/api";
import { useDrawFeed, type DrawResult } from "@/features/draw/feed";
import { ResultBalls } from "@/features/draw/ResultBalls";
import { drawAtOf } from "@/features/draw/schedule";
import { revealedAt } from "@/features/draw/stage/timeline";
import { useNow } from "@/features/draw/useNextDraw";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type Notice = {
  drawAt: number;
  drawNo: string;
  result: DrawResult;
  /** 這一期下了幾注 */
  lines: number;
  /** 中獎的獎級和注數，獎級高的在前（後端結算的結果） */
  tiers: { tier: Tier; count: number }[];
  /** 這一期的總獎金 */
  total: number;
};

/** 中獎提示停留久一點，沒中獎的很快消失 */
const WIN_MS = 9000;
const LOSE_MS = 5000;

/**
 * 開獎結果通知：自己有下注的那一期，開獎動畫播完（revealedAt）時跳出來。
 * - 中獎：金色卡片 + 火花 + 獎金累加，列出獎級和注數；頭獎到三獎更大（後端結算的結果）
 * - 沒中獎：小卡片，很快消失
 * 只通知「打開頁面之後」才公布的期數，重新整理不會把舊的再跳一次。
 * 放在遊戲端版面裡（任何遊戲頁面都會收到）。
 */
export function DrawNotices() {
  const username = useSession((s) => s.user?.username);
  const tickets = useRecentTickets(username).data?.list;
  const now = useNow();
  const results = useDrawFeed((s) => s.results);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [notified, setNotified] = useState<ReadonlySet<number>>(new Set());
  const [notices, setNotices] = useState<Notice[]>([]);

  // 在渲染時比對（React 文件建議的「依 props 調整 state」做法，不用 effect）
  if (now !== null && startedAt === null) setStartedAt(now);
  if (now !== null && startedAt !== null) {
    // 動畫播完、有開獎號碼、而且這期的注單都結算完了（SETTLED 比動畫早 20 幾秒到，通常早就結算好）
    const due = [...new Set((tickets ?? []).map((ticket) => ticket.drawNo))].filter((drawNo) => {
      const at = revealedAt(drawAtOf(drawNo));
      const settled = tickets!.every((ticket) => ticket.drawNo !== drawNo || ticket.status !== "PENDING");
      return at > startedAt && at <= now && !notified.has(drawAtOf(drawNo)) && results[drawNo] && settled;
    });
    if (due.length > 0) {
      setNotified(new Set([...notified, ...due.map(drawAtOf)]));
      setNotices((list) => [
        ...list,
        ...due.map((drawNo) => buildNotice(drawNo, tickets!.filter((ticket) => ticket.drawNo === drawNo), results[drawNo])),
      ]);
    }
  }

  // 固定的函式：這個組件每秒重新渲染一次，不固定的話卡片的自動消失計時器會一直重來
  const dismiss = useCallback((drawAt: number) => setNotices((list) => list.filter((n) => n.drawAt !== drawAt)), []);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-3 top-16 z-50 flex flex-col items-stretch gap-3 md:inset-x-auto md:top-20 md:right-6 md:w-90"
    >
      <AnimatePresence initial={false}>
        {notices.map((n) => (
          <NoticeCard key={n.drawAt} notice={n} onDismiss={dismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function buildNotice(drawNo: string, tickets: Ticket[], result: DrawResult): Notice {
  const byTier = new Map<Tier, number>();
  for (const ticket of tickets) {
    for (const line of ticket.results ?? []) {
      if (line.tier) byTier.set(line.tier, (byTier.get(line.tier) ?? 0) + 1);
    }
  }
  return {
    drawAt: drawAtOf(drawNo),
    drawNo,
    result,
    lines: tickets.reduce((sum, ticket) => sum + ticket.lines.length, 0),
    tiers: TIERS.filter((tier) => byTier.has(tier)).map((tier) => ({ tier, count: byTier.get(tier)! })),
    total: tickets.reduce((sum, ticket) => sum + ticket.payout, 0),
  };
}

function NoticeCard({ notice, onDismiss }: { notice: Notice; onDismiss: (drawAt: number) => void }) {
  const t = useTranslations("Notice");
  const tt = useTranslations("Tier");
  const won = notice.total > 0;
  const big = notice.tiers.some((x) => x.tier === "FIRST" || x.tier === "SECOND" || x.tier === "THIRD");
  const { drawAt } = notice;
  const close = () => onDismiss(drawAt);

  // 自動消失（滑鼠移上去時暫停，讓人看得完）
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const id = setTimeout(() => onDismiss(drawAt), won ? WIN_MS : LOSE_MS);
    return () => clearTimeout(id);
  }, [paused, won, drawAt, onDismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 40, transition: { duration: 0.2 } }}
      transition={{ type: "spring", stiffness: 420, damping: 30 }}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      className={cn(
        "pointer-events-auto relative flex flex-col gap-3 overflow-hidden rounded-card border p-4",
        won
          ? "border-gold bg-[radial-gradient(120%_90%_at_100%_0%,rgba(244,182,63,0.22)_0%,var(--color-panel)_60%)] shadow-[0_0_0_1px_rgba(244,182,63,0.25),0_20px_60px_rgba(0,0,0,0.5),0_0_40px_rgba(244,182,63,0.18)]"
          : "border-line bg-panel shadow-[0_20px_50px_rgba(0,0,0,0.45)]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted">{t("drawNo", { drawNo: notice.drawNo })}</span>
          <strong className={cn("font-bold", won ? (big ? "text-2xl text-gold" : "text-lg text-gold") : "text-base text-fg")}>
            {won ? (big ? t("bigWin", { tier: tt(notice.tiers[0].tier) }) : t("win")) : t("lose", { count: notice.lines })}
          </strong>
        </div>
        <button
          type="button"
          aria-label={t("close")}
          onClick={close}
          className="-m-1 grid size-9 shrink-0 place-items-center rounded-control text-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-gold"
        >
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      {won && (
        <div className="flex items-end justify-between gap-3">
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0 text-sm text-fg-soft">
            {notice.tiers.map(({ tier, count }) => (
              <li key={tier}>{t("tierCount", { tier: tt(tier), count })}</li>
            ))}
          </ul>
          <span className="relative flex items-baseline gap-1 text-gold">
            <span className="font-num text-[40px] leading-none font-bold">
              +<CountUp to={notice.total} duration={1.4} delay={0.25} />
            </span>
            <span className="text-sm">{t("points")}</span>
            <Sparks count={big ? 20 : 12} />
          </span>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <ResultBalls result={notice.result} size="xs" />
        <Link href="/bets" onClick={close} className="shrink-0 text-[13px] text-gold no-underline hover:underline">
          {t("viewBets")}
        </Link>
      </div>
    </motion.div>
  );
}

/** 中獎金額旁迸出一圈金色火花（一次，純 CSS；reduced-motion 時不顯示） */
function Sparks({ count }: { count: number }) {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute top-1/2 left-1/3 motion-reduce:hidden">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="absolute top-0 left-0 h-0.5 w-3 origin-left rounded-full bg-gold-bright opacity-0"
          style={{
            ["--angle" as string]: `${(360 / count) * i}deg`,
            animation: `spark 700ms ${250 + (i % 3) * 60}ms cubic-bezier(0.22, 1, 0.36, 1) forwards`,
          }}
        />
      ))}
    </span>
  );
}
