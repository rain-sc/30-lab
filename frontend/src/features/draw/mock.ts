// 【示例資料】後端還沒有期數 API（見 docs/api-changelog.md）。
// 畫面上用到這裡的資料時，要同時顯示「示例數據」標籤。接口出來後刪掉這個檔案。
export const SAMPLE_JACKPOT = 128460;

export type DrawResult = { numbers: number[]; special: number };

/**
 * 依期數號產生固定的示例開獎結果：同一期每次算出來都一樣（重新整理不會變），
 * 換到下一期就換一組號碼，讓「倒數歸零換球」的動畫看得到效果。
 */
export function sampleResultFor(drawNo: string): DrawResult {
  // 字串 → 種子（FNV-1a），再用 mulberry32 產生偽隨機數
  let seed = 2166136261;
  for (const ch of drawNo) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619);
  const random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const pool = Array.from({ length: 49 }, (_, i) => i + 1);
  const picked = Array.from({ length: 7 }, () => pool.splice(Math.floor(random() * pool.length), 1)[0]);
  return { numbers: picked.slice(0, 6), special: picked[6] };
}
