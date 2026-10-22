"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { Ball } from "@/components/Ball";
import { cn } from "@/lib/utils";

// 開獎舞台的 2D 替身：水晶球的輪廓（金色光邊 + 49 格刻度，對應 stage/crystal.ts），裡面 4 顆號碼球沿著光邊繞圈（設計稿 B：https://claude.ai/artifact/8QsQ7GWpHopGfrZCrsxvtM）
// 用在：3D 舞台載入完成前、手機大廳卡片上的縮圖、不支援 WebGL 時（moving = false，球停住）
// 純 CSS 動畫：伺服器渲染就會動，不用等 JS；reduced-motion 時停住

/** 伺服器渲染用的固定號碼（避免 hydration 不一致），瀏覽器接手後換成隨機的 */
const INITIAL = [8, 23, 31, 45];
/** 4 顆球依序落後 0.38 秒，一前一後繞圈 */
const LAG_MS = 380;

const randomNumbers = () => {
  const picked = new Set<number>();
  while (picked.size < INITIAL.length) picked.add(1 + Math.floor(Math.random() * 49));
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
  const [numbers, setNumbers] = useState(INITIAL);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 掛載後才換成隨機號碼：伺服器和第一次渲染要一樣
    setNumbers(randomNumbers());
  }, []);

  return (
    <div role={caption ? "status" : undefined} aria-hidden={caption ? undefined : true} className={cn("@container relative aspect-square", className)}>
      {/* 49 格刻度：圓錐漸層畫出放射線，再用圓形遮罩只留外圈 */}
      <div className="absolute inset-0 rounded-full bg-[repeating-conic-gradient(from_-0.6deg,var(--color-line-strong)_0_1.2deg,transparent_1.2deg_7.3469deg)] mask-[radial-gradient(closest-side,transparent_95%,#000_95.5%)]" />
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
