import type { ReactNode } from "react";
import { GameSessionGate } from "@/features/auth/GameSessionGate";
import { DrawNotices } from "@/features/game/DrawNotices";
import { GameHeader } from "@/features/game/GameHeader";
import { TabBar } from "@/features/game/TabBar";

// 遊戲端共用版面：頁首、內容（要登入）、手機底部分頁
// 手機版內容下方留出底部分頁的高度
export default function GameLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col bg-stage">
      <GameHeader />
      <main className="flex flex-1 flex-col pb-20 md:pb-0">
        <GameSessionGate>
          {children}
          {/* 開獎結果通知（中獎提示）：任何遊戲頁面都會收到 */}
          <DrawNotices />
        </GameSessionGate>
      </main>
      <TabBar />
    </div>
  );
}
