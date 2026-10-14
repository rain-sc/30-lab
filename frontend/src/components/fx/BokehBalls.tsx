"use client";

// 背景散景號碼球：紅藍綠號碼球模糊地漂浮在背景，近大遠小、近模糊遠清楚，滑鼠移動時有視差
// 參考：React Bits「Particles」 https://reactbits.dev/backgrounds/particles（大小不一、有景深的漂浮圓點）
// 改動：圓點換成六合彩號碼球，用 CSS blur 做景深；漂浮用 CSS 動畫，視差用 CSS 變數，不需要 WebGL。
// 位置是固定的（不隨機），伺服器和瀏覽器渲染一致；球放在畫面四周和面板、卡片之間的空隙，避開倒數和表單。
// reduced-motion：不漂浮、不視差。觸控裝置沒有游標，不做視差。
import { useEffect, useRef, type CSSProperties } from "react";
import { ballColor, type BallColor } from "@/lib/ball";

type Bokeh = {
  n: number;
  /** 中心位置，相對容器的百分比 */
  x: number;
  y: number;
  /** 桌面版直徑（px），手機乘上 --bokeh-scale */
  size: number;
  /** 景深：0 = 遠（小、清楚）… 1 = 近（大、模糊） */
  depth: number;
  /** 漂浮一個來回的秒數、起始延遲、漂浮位移 */
  dur: number;
  delay: number;
  dx: number;
  dy: number;
};

const BALLS: Bokeh[] = [
  // 近：大、很模糊，放在角落
  { n: 7, x: -2, y: 10, size: 220, depth: 1, dur: 26, delay: 3, dx: 24, dy: 30 },
  { n: 36, x: 92, y: 86, size: 240, depth: 1, dur: 28, delay: 9, dx: -30, dy: -22 },
  { n: 21, x: 80, y: -6, size: 160, depth: 0.85, dur: 22, delay: 5, dx: -20, dy: 26 },
  { n: 13, x: 8, y: 92, size: 170, depth: 0.85, dur: 24, delay: 12, dx: 26, dy: -20 },
  // 中：中等大小、稍微模糊
  { n: 42, x: 46, y: 12, size: 74, depth: 0.5, dur: 19, delay: 2, dx: 18, dy: 16 },
  { n: 5, x: 60, y: 74, size: 66, depth: 0.5, dur: 17, delay: 7, dx: -14, dy: -18 },
  { n: 30, x: 32, y: 94, size: 58, depth: 0.45, dur: 18, delay: 4, dx: 16, dy: -12 },
  { n: 26, x: 98, y: 42, size: 62, depth: 0.45, dur: 20, delay: 10, dx: -16, dy: 14 },
  // 遠：小、清楚到看得見號碼
  { n: 18, x: 24, y: 20, size: 34, depth: 0.1, dur: 15, delay: 1, dx: 10, dy: 12 },
  { n: 44, x: 57, y: 44, size: 30, depth: 0.1, dur: 16, delay: 6, dx: -8, dy: 14 },
  { n: 9, x: 72, y: 94, size: 36, depth: 0.15, dur: 14, delay: 8, dx: 12, dy: -10 },
  { n: 33, x: 3, y: 58, size: 40, depth: 0.2, dur: 17, delay: 11, dx: 12, dy: -14 },
];

const COLOR_VAR: Record<BallColor, string> = {
  red: "var(--color-ball-red)",
  blue: "var(--color-ball-blue)",
  green: "var(--color-ball-green)",
};

export function BokehBalls() {
  const ref = useRef<HTMLDivElement>(null);

  // 滑鼠視差：把游標位置（-1 ~ 1）寫進 CSS 變數，每顆球依景深位移；用 rAF 節流，不觸發 React 重新渲染
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let px = 0;
    let py = 0;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      px = (e.clientX / window.innerWidth) * 2 - 1;
      py = (e.clientY / window.innerHeight) * 2 - 1;
      raf ||= requestAnimationFrame(() => {
        raf = 0;
        el.style.setProperty("--px", px.toFixed(3));
        el.style.setProperty("--py", py.toFixed(3));
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden [--bokeh-scale:0.6] md:[--bokeh-scale:1]"
    >
      {BALLS.map((b) => {
        const color = COLOR_VAR[ballColor(b.n)];
        const dark = `color-mix(in srgb, ${color} 45%, black)`;
        // 視差：近的球往滑鼠反方向移動多一點
        const shiftX = -36 * b.depth;
        const shiftY = -24 * b.depth;

        return (
          <div
            key={b.n}
            className="absolute aspect-square transition-transform duration-700 ease-out will-change-transform"
            style={{
              left: `${b.x}%`,
              top: `${b.y}%`,
              width: `calc(${b.size}px * var(--bokeh-scale))`,
              transform: `translate(-50%, -50%) translate(calc(var(--px, 0) * ${shiftX}px), calc(var(--py, 0) * ${shiftY}px))`,
              filter: `blur(${Math.round(b.depth * 14)}px)`,
              opacity: 0.42 - b.depth * 0.18,
            }}
          >
            <div
              className="size-full animate-bokeh-float motion-reduce:animate-none"
              style={
                {
                  animationDuration: `${b.dur}s`,
                  animationDelay: `-${b.delay}s`,
                  "--dx": `${b.dx}px`,
                  "--dy": `${b.dy}px`,
                } as CSSProperties
              }
            >
              <div
                className="grid size-full place-items-center rounded-full"
                style={{
                  background: `radial-gradient(circle at 32% 28%, rgba(255,255,255,0.6) 0, rgba(255,255,255,0) 28%), radial-gradient(circle at 50% 55%, ${color} 50%, ${dark} 100%)`,
                }}
              >
                <span
                  className="grid size-[46%] place-items-center rounded-full bg-white font-num font-bold"
                  style={{ fontSize: `calc(${Math.round(b.size * 0.2)}px * var(--bokeh-scale))`, color: dark }}
                >
                  {b.n}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
