// 每 5 分鐘開獎一次（期數號、時間以後端為準，見 feed.ts）
import { DRAW_INTERVAL_MINUTES } from "./rules";

export const INTERVAL_MS = DRAW_INTERVAL_MINUTES * 60 * 1000;
