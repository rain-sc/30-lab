// 香港六合彩的號碼波色（固定對照表）
const RED = new Set([1, 2, 7, 8, 12, 13, 18, 19, 23, 24, 29, 30, 34, 35, 40, 45, 46]);
const BLUE = new Set([3, 4, 9, 10, 14, 15, 20, 25, 26, 31, 36, 37, 41, 42, 47, 48]);

export type BallColor = "red" | "blue" | "green";

export function ballColor(n: number): BallColor {
  if (RED.has(n)) return "red";
  if (BLUE.has(n)) return "blue";
  return "green";
}
