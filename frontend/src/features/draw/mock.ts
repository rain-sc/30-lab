// 【示例資料】後端還沒有彩池（要等結算模組，見 docs/api-changelog.md），由前端模擬。
// 畫面上用到這裡的資料時，要同時顯示「示例數據」標籤。接口出來後刪掉這個檔案。
// 期數、開獎號碼、開獎紀錄、積分、下注已經接上後端

export const SAMPLE_JACKPOT = 128460;

/** 一期的開獎號碼：6 個正碼 + 特別號碼（畫面和對獎用的最小格式） */
export type DrawResult = { numbers: number[]; special: number };
