// 遊戲端的頁面：桌面頁首的導覽、手機底部分頁共用
// 冷熱號碼在桌面版放在大廳最下方，所以只出現在手機分頁
export const GAME_NAV = [
  { href: "/", key: "lobby", mobileOnly: false },
  { href: "/trends", key: "trends", mobileOnly: true },
  { href: "/history", key: "history", mobileOnly: false },
  { href: "/bets", key: "bets", mobileOnly: false },
] as const;

export type GameNavKey = (typeof GAME_NAV)[number]["key"];
