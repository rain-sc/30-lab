// 開獎相關的接口（都不用登入）
import { api } from "@/lib/api/client";
import type { components } from "@/types/api";

export type DrawPage = components["schemas"]["PageResultDrawResponse"];

/** 每頁最多幾筆（後端上限，超過會被改成 100） */
export const MAX_PAGE_SIZE = 100;

/** 開獎紀錄（只有已開獎的期數），由新到舊；期數號可能不連續（後端停機期間沒有期數） */
export function fetchDraws(page: number, size: number) {
  return api.get<DrawPage>("/draws", { params: { page, size }, redirectOnUnauthorized: false });
}
