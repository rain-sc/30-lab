// 【示例資料】後端還沒有彩池、下注、錢包 API（見 docs/api-changelog.md），由前端模擬。
// 畫面上用到這裡的資料時，要同時顯示「示例數據」標籤。接口出來後刪掉這個檔案。
// 期數、開獎號碼、開獎紀錄已經接上後端（feed.ts、api.ts）

export const SAMPLE_JACKPOT = 128460;

/** 示例錢包的起始積分（註冊贈送的數字還沒定，見 docs/game-rules.md） */
export const SAMPLE_INITIAL_POINTS = 1000;

/** 頭獎到三獎的示例獎金（正式規則是彩池分配，比例還沒定） */
export const SAMPLE_POOL_PRIZES = { 1: SAMPLE_JACKPOT, 2: 20000, 3: 3000 } as const;

/** 一期的開獎號碼：6 個正碼 + 特別號碼（畫面和對獎用的最小格式） */
export type DrawResult = { numbers: number[]; special: number };
