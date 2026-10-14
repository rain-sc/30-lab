import { z } from "zod";
import type messages from "@/i18n/messages/zh-TW.json";

// 錯誤訊息存的是翻譯 key（Auth.errors.*），由表單組件翻譯，schema 本身不依賴語系
export type AuthErrorKey = keyof (typeof messages)["Auth"]["errors"];
const err = (key: AuthErrorKey) => ({ error: key });

// 欄位規則（暫定，要和後端一致，見 docs/api-changelog.md）
export const USERNAME_PATTERN = /^[A-Za-z0-9_]{4,20}$/;
export const NICKNAME_LENGTH = { min: 2, max: 16 };
export const PASSWORD_LENGTH = { min: 8, max: 64 };

// 翻譯文字裡的數字從這裡帶入（欄位說明、錯誤訊息共用），規則只改這一處
export const RULE_PARAMS = {
  nicknameMin: NICKNAME_LENGTH.min,
  nicknameMax: NICKNAME_LENGTH.max,
  passwordMin: PASSWORD_LENGTH.min,
  passwordMax: PASSWORD_LENGTH.max,
};

// 登入只檢查有沒有填，不洩漏格式規則
export const loginSchema = z.object({
  username: z.string().trim().min(1, err("usernameRequired")),
  password: z.string().min(1, err("passwordRequired")),
});

export const registerSchema = z
  .object({
    username: z.string().trim().regex(USERNAME_PATTERN, err("usernameFormat")),
    nickname: z
      .string()
      .trim()
      .min(NICKNAME_LENGTH.min, err("nicknameLength"))
      .max(NICKNAME_LENGTH.max, err("nicknameLength")),
    password: z
      .string()
      .min(PASSWORD_LENGTH.min, err("passwordLength"))
      .max(PASSWORD_LENGTH.max, err("passwordLength")),
    confirmPassword: z.string().min(1, err("confirmRequired")),
  })
  .refine((v) => v.password === v.confirmPassword, {
    ...err("passwordMismatch"),
    path: ["confirmPassword"],
  });

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
