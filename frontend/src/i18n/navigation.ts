import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// 專案內的頁面跳轉一律用這裡的 Link / redirect / useRouter，會自動補上語系前綴
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
