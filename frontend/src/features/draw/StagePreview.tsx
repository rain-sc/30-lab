import { ballColor } from "@/lib/ball";
import { cn } from "@/lib/utils";

// 開獎舞台的靜態示意：玻璃球裡堆著 49 顆號碼球（純 CSS，不跑 WebGL）
// 用在：3D 舞台載入完成前的佔位圖、手機版卡片上的縮圖、不支援 WebGL 時的替代畫面

const BG: Record<ReturnType<typeof ballColor>, string> = {
  red: "bg-ball-red",
  blue: "bg-ball-blue",
  green: "bg-ball-green",
};

/** 球的直徑（佔玻璃球直徑的百分比） */
const SIZE = 8;

/** 49 顆球堆在玻璃球底部的位置（百分比，固定不隨機，伺服器和瀏覽器算出來一樣） */
const PILE = (() => {
  const out: { n: number; x: number; y: number }[] = [];
  const R = 50;
  const gap = SIZE + 0.5;
  for (let row = 0; out.length < 49 && row < 20; row++) {
    const cy = 100 - 2 - SIZE / 2 - row * SIZE * 0.86;
    const half = Math.sqrt(Math.max(0, (R - 1.5) ** 2 - (cy - R) ** 2)) - SIZE / 2 - 0.5;
    for (let x = -half + ((row % 2) * gap) / 2; x <= half && out.length < 49; x += gap) {
      const i = out.length;
      out.push({ n: ((i * 17) % 49) + 1, x: R + x - SIZE / 2 + Math.sin(i * 1.7) * 0.5, y: cy - SIZE / 2 + Math.cos(i * 2.3) * 0.5 });
    }
  }
  return out;
})();

/** numbers：小尺寸（手機縮圖）時不顯示號碼 */
export function StagePreview({ className, numbers = true }: { className?: string; numbers?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "@container relative aspect-square overflow-hidden rounded-full border border-white/15",
        "bg-[radial-gradient(circle_at_34%_24%,rgba(255,255,255,0.14)_0,rgba(255,255,255,0.03)_32%,rgba(11,16,32,0.25)_70%)]",
        "shadow-[inset_0_0_50px_rgba(140,165,255,0.10),0_24px_50px_rgba(0,0,0,0.35)]",
        className,
      )}
    >
      {PILE.map(({ n, x, y }) => (
        <span
          key={n}
          className={cn(
            "absolute grid place-items-center rounded-full font-num text-[3.6cqw] font-bold text-white",
            "shadow-[inset_-2px_-3px_4px_rgba(0,0,0,0.35),inset_1px_2px_3px_rgba(255,255,255,0.28)]",
            BG[ballColor(n)],
          )}
          style={{ left: `${x}%`, top: `${y}%`, width: `${SIZE}%`, height: `${SIZE}%` }}
        >
          {numbers ? n : null}
        </span>
      ))}
    </div>
  );
}
