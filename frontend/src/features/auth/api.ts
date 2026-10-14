import type { LoginValues, RegisterValues } from "./schemas";

// 【模擬】後端還沒有登入、註冊 API（見 docs/api-changelog.md）。
// 接口出來後換成 lib/api 的請求封裝，回傳型別改用 OpenAPI 生成的型別。
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function login(values: LoginValues): Promise<void> {
  void values;
  await delay(800);
}

export async function register(values: Omit<RegisterValues, "confirmPassword">): Promise<void> {
  void values;
  await delay(800);
}
