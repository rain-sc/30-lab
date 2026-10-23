"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { Ball } from "@/components/Ball";
import { cn } from "@/lib/utils";
import { useGameRules } from "./rules";
import { GLOBE, ROW_Y, SLOT_X, SOCKET_R, TICK, TRAY, VIEW } from "./stage/layout";

// 開獎舞台的 2D 替身：水晶球的輪廓（金色光邊 + 號碼刻度（一格一個號碼），對應 stage/crystal.ts），裡面 4 顆號碼球沿著光邊繞圈（設計稿 B：https://claude.ai/artifact/8QsQ7GWpHopGfrZCrsxvtM）
// 用在：手機大廳卡片上的縮圖（StagePreview）；3D 舞台載入完成前、不支援 WebGL 時（StageLoading：加上結果列，位置和 3D 一樣）
// 純 CSS 動畫：伺服器渲染就會動，不用等 JS；reduced-motion 時停住

/** 伺服器渲染用的固定號碼（避免 hydration 不一致），瀏覽器接手後換成隨機的 */
const INITIAL = [8, 17, 23, 29];
/** 4 顆球依序落後 0.38 秒，一前一後繞圈 */
const LAG_MS = 380;

const randomNumbers = (maxNumber: number) => {
  const picked = new Set<number>();
  while (picked.size < INITIAL.length) picked.add(1 + Math.floor(Math.random() * maxNumber));
  return [...picked];
};

export function StagePreview({
  className,
  moving = true,
  caption,
}: {
  className?: string;
  /** false：球停在邊上（不支援 WebGL 時，不要看起來一直在載入） */
  moving?: boolean;
  /** 中間的文字（例如「攪珠台準備中…」）；手機縮圖太小不放 */
  caption?: string;
}) {
  const { maxNumber } = useGameRules();
  const [numbers, setNumbers] = useState(INITIAL);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 掛載後才換成隨機號碼：伺服器和第一次渲染要一樣
    setNumbers(randomNumbers(maxNumber));
  }, [maxNumber]);

  return (
    <div role={caption ? "status" : undefined} aria-hidden={caption ? undefined : true} className={cn("@container relative aspect-square", className)}>
      {/* 刻度（一格一個號碼）：圓錐漸層畫出放射線，再用圓形遮罩只留外圈；--tick = 360° ÷ 號碼數 */}
      <div
        style={{ "--tick": `${360 / maxNumber}deg` } as CSSProperties}
        className="absolute inset-0 rounded-full bg-[repeating-conic-gradient(from_-0.6deg,var(--color-line-strong)_0_1.2deg,transparent_1.2deg_var(--tick))] mask-[radial-gradient(closest-side,transparent_95%,#000_95.5%)]" />
      <div
        className={cn(
          "absolute inset-[6.75%] rounded-full border border-gold/70",
          "bg-[radial-gradient(circle_at_50%_50%,#1d2848_0,var(--color-sunken)_65%,#070a15_100%)]",
          "shadow-[0_0_18px_rgba(244,182,63,0.4),inset_0_0_22px_rgba(244,182,63,0.18)]",
          moving && "animate-rim-breathe motion-reduce:animate-none",
        )}
      />
      {numbers.map((n, i) => (
        // 外層繞圈，球再反方向轉回來，號碼保持正向（兩層都是 transform 動畫）
        // 停住時（不動、reduced-motion）改用 rotate 屬性把 4 顆平均分在一圈上；播放時不套用，不然會和動畫疊加
        <span
          key={i}
          aria-hidden="true"
          className={cn("absolute inset-[6.75%]", moving ? "animate-orbit motion-reduce:rotate-(--at) motion-reduce:animate-none" : "rotate-(--at)")}
          style={{ animationDelay: `${-i * LAG_MS}ms`, "--at": `${i * 0.25}turn` } as CSSProperties}
        >
          <span
            className={cn(
              "absolute top-[9%] left-1/2 -translate-1/2",
              moving ? "animate-orbit-reverse motion-reduce:-rotate-(--at) motion-reduce:animate-none" : "-rotate-(--at)",
            )}
            style={{ animationDelay: `${-i * LAG_MS}ms` }}
          >
            <Ball number={n} className="size-[13cqw] text-[6cqw]" />
          </span>
        </span>
      ))}
      {caption && (
        <span className="absolute inset-0 grid place-items-center px-[22%] text-center text-[max(12px,5cqw)] text-muted">{caption}</span>
      )}
    </div>
  );
}

// ---------- 3D 舞台的替身：結果列 + 水晶球，擺在和 3D 一樣的位置 ----------
// 換算和 engine.ts 的 fitCamera 一樣（相機框住 VIEW，往後退 1.5 單位）：
// --u = 每個場景單位幾個像素 = min(容器高 ÷ (VIEW 高 + 0.75), 容器寬 ÷ (VIEW 寬 + 0.75 × 寬高比))；畫面中心是 VIEW 的中心
// 結果列、水晶球都在 z ≈ -1.2（球的後面），透視下小約 2%：再乘 DEPTH
const VIEW_W = VIEW.xMax - VIEW.xMin;
const VIEW_H = VIEW.yMax - VIEW.yMin;
const VIEW_CY = (VIEW.yMax + VIEW.yMin) / 2;
const DEPTH = 0.978;
const PAD = 0.75;
const UNIT = `min(calc(100cqh / ${VIEW_H + PAD}), calc(100cqw / ${VIEW_W * (1 + PAD / VIEW_H)}))`;
/** 場景座標 → 相對容器中心的 CSS 長度 */
const at = (v: number) => `calc(${v * DEPTH} * var(--u))`;
/** 以 (x, y) 為中心、寬 w 高 h 的方塊 */
const box = (x: number, y: number, w: number, h = w): CSSProperties => ({
  left: `calc(50% + ${at(x - w / 2)})`,
  top: `calc(50% - ${at(y - VIEW_CY + h / 2)})`,
  width: at(w),
  height: at(h),
});

/**
 * 3D 舞台載入前（和不支援 WebGL 時）的畫面：結果列的凹槽、7 個球座、水晶球（StagePreview），
 * 位置、大小照 layout.ts 換算，和載入後的 3D 對齊。放在和 canvas 一樣大的容器裡（DrawStage 的 top-10 bottom-0）
 */
export function StageLoading({ className, moving = true, caption }: { className?: string; moving?: boolean; caption?: string }) {
  const ring = 2 * (TICK.r + TICK.major / 2);
  return (
    <div className={cn("relative [container-type:size]", className)} style={{ "--u": UNIT } as CSSProperties}>
      <div aria-hidden="true" className="absolute rounded-full border border-line bg-sunken" style={box(0, ROW_Y, TRAY.w, TRAY.h)} />
      {SLOT_X.map((x, i) => (
        <span
          key={x}
          aria-hidden="true"
          className={cn("absolute rounded-full border-[1.5px]", i === SLOT_X.length - 1 ? "border-gold/60" : "border-line-strong")}
          style={box(x, ROW_Y, SOCKET_R * 2)}
        />
      ))}
      <span
        aria-hidden="true"
        className="absolute grid place-items-center font-bold text-muted"
        style={{ ...box((SLOT_X[5] + SLOT_X[6]) / 2, ROW_Y, 0.9), fontSize: at(0.9) }}
      >
        +
      </span>
      <div className="absolute" style={box(0, GLOBE.cy, ring)}>
        <StagePreview className="w-full" moving={moving} caption={caption} />
      </div>
    </div>
  );
}
