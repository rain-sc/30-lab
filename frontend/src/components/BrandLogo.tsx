import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

// 品牌標誌：金色的「6」號碼球 + 字標。品牌名不翻譯。
export function BrandLogo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("inline-flex min-w-0 items-center gap-2.5 text-fg no-underline", className)}>
      <span
        aria-hidden="true"
        className="grid size-7 shrink-0 place-items-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#ffe3a3_0,var(--color-gold)_45%,#b9811c_100%)] font-num text-[17px] font-extrabold text-gold-ink md:size-8.5 md:text-xl"
      >
        6
      </span>
      <span className="truncate font-num text-lg font-extrabold tracking-[0.1em] whitespace-nowrap sm:text-xl sm:tracking-[0.12em] md:text-2xl">MARK SIX LAB</span>
    </Link>
  );
}
