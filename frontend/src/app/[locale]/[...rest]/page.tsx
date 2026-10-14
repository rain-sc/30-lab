import { notFound } from "next/navigation";

// 接住 /zh-TW/任何不存在的路徑，交給 [locale]/not-found.tsx 顯示翻譯過的 404
export default function CatchAll() {
  notFound();
}
