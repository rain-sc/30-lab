import type { GameNavKey } from "./nav";

// 底部分頁的圖示（線條，跟著文字顏色）
const PATHS: Record<GameNavKey, React.ReactNode> = {
  lobby: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  trends: (
    <>
      <path d="M12 3c1 3 4 4.5 4 8.5a4 4 0 0 1-8 0c0-1.6.7-2.7 1.5-3.5.2 1.2.9 2 1.8 2.3C11 8 11 5.5 12 3z" />
      <path d="M5 20h14" />
    </>
  ),
  history: <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />,
  leaderboard: (
    <>
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4" />
    </>
  ),
  bets: (
    <>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
};

export function NavIcon({ name }: { name: GameNavKey }) {
  return (
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      {PATHS[name]}
    </svg>
  );
}
