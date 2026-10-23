// 開獎舞台的版面（場景單位）：3D 引擎和 2D 載入動畫（StagePreview 的 StageLoading）共用，
// 載入動畫照這些數字擺結果列和水晶球，換成 3D 時位置、大小一樣，畫面不會跳。
// 這個檔案不能 import three（StagePreview 在首頁的初始 JS 裡）

/** 球半徑：30 顆球用 1.0，佔玻璃球的面積和原本 49 顆 × 0.8 差不多（約 34%） */
export const R = 1;

/** 玻璃球（物理邊界：球撞的圓） */
export const GLOBE = { cy: -1.2, r: 9.4, seg: 48 };

/** 水晶球外圈的號碼刻度：中心半徑、長刻度的長度（crystal.ts） */
export const TICK = { r: GLOBE.r + 1.28, major: 0.62 };

/** 結果列：6 個正碼 + 特別號碼的位置、凹槽大小、球座半徑 */
export const ROW_Y = 11.6;
// 間距 2.4：球座直徑 2 × (R + 0.13) = 2.26，相鄰的不會碰在一起；特別號碼和第 6 顆之間留位置放「+」
export const SLOT_X = [-8.6, -6.2, -3.8, -1.4, 1, 3.4, 7.2];
export const TRAY = { w: 20.2, h: 2.6 };
export const SOCKET_R = R + 0.13;

/** 相機要框住的範圍（含外圈的號碼刻度） */
export const VIEW = { xMin: -11.1, xMax: 11.1, yMin: -12.4, yMax: 13 };
