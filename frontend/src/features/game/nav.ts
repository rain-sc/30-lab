// 遊戲端的頁面：桌面頁首的導覽、手機底部分頁共用
// 冷熱號碼在桌面版放在大廳最下方，所以只出現在手機分頁
// 玩法說明只在桌面導覽：手機底部分頁已經 5 個，入口在選號盤的「?」、彩池卡片、使用者選單
export const GAME_NAV = [
  { href: "/", key: "lobby", mobileOnly: false, desktopOnly: false },
  { href: "/trends", key: "trends", mobileOnly: true, desktopOnly: false },
  { href: "/history", key: "history", mobileOnly: false, desktopOnly: false },
  { href: "/bets", key: "bets", mobileOnly: false, desktopOnly: false },
  { href: "/leaderboard", key: "leaderboard", mobileOnly: false, desktopOnly: false },
  { href: "/rules", key: "rules", mobileOnly: false, desktopOnly: true },
] as const;

export type GameNavKey = (typeof GAME_NAV)[number]["key"];
