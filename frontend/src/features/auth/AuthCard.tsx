"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AuthTabs, authPanelId, authTabId, type AuthMode } from "./AuthTabs";
import { LoginForm } from "./LoginForm";
import { RegisterForm } from "./RegisterForm";

// 登入 / 註冊同一個路由（/login），用分頁切換兩個表單組件。
// 切換時舊表單淡出、新表單淡入；兩個表單各自管理自己的狀態，切換後輸入內容會清空。
export function AuthCard() {
  const [mode, setMode] = useState<AuthMode>("login");

  return (
    <>
      <AuthTabs value={mode} onChange={setMode} />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={mode}
          role="tabpanel"
          id={authPanelId(mode)}
          aria-labelledby={authTabId(mode)}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
        >
          {mode === "login" ? <LoginForm /> : <RegisterForm />}
        </motion.div>
      </AnimatePresence>
    </>
  );
}
