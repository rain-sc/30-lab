"use client";

import { useDrawFeed } from "../feed";
import { useNow } from "../useNextDraw";
import { stagePhaseAt, type StagePhase } from "./timeline";

/** 目前的舞台階段（每秒更新，給畫面上的文字用；3D 舞台每一幀自己算） */
export function useStagePhase(reduced: boolean): StagePhase | null {
  const now = useNow();
  const current = useDrawFeed((s) => s.current);
  const previous = useDrawFeed((s) => s.previous);
  return now === null ? null : stagePhaseAt(now, { current, previous }, reduced);
}
