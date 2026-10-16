// 同一個瀏覽器裡「哪個分頁在使用帳號」的狀態
//
// 背景：同一個瀏覽器的分頁共用同一個 cookie。分頁 2 登入後，分頁 1 送出的請求帶的也是分頁 2 的 session，
// 後端看到的兩個分頁完全一樣、分辨不出是誰。所以「分頁 1 登出、分頁 2 繼續用」只能靠前端自己做：
//
// 規則：**同一個瀏覽器裡，最後登入的分頁才能使用帳號；其他分頁一律變成登出狀態。**
// - 通知：登入成功的分頁用 BroadcastChannel 廣播，其他分頁收到後切換成登出（見 SessionGuard）
// - 記住：sessionStorage 是每個分頁各自一份，用來記「這個分頁已登出」。標記還在時，這個分頁一律當成未登入：
//   不打 /me、需要登入的請求直接擋下（見 client.ts 的請求攔截器），重新整理或點 logo 回首頁也不會變回已登入
// - 這個分頁自己重新登入時清掉標記，換別的分頁被登出（規則對稱）
// - 只在畫面上登出，**不呼叫 logout API**：cookie 屬於最後登入的分頁，呼叫會把它也登出

/**
 * 登出的原因，登入頁會顯示對應的提示（SessionNotice）：
 * - expired：未登入或登入過期（40100）
 * - replaced：同一個帳號在別的裝置登入，這裡被踢掉（40102、WebSocket 的 SESSION_REPLACED）
 * - other-tab：這個瀏覽器的另一個分頁登入了，這個分頁變成登出
 * 原因存在 sessionStorage，不放在網址上（網址保持乾淨的 /login）
 */
export const SIGN_OUT_REASONS = ["expired", "replaced", "other-tab"] as const;
export type SignOutReason = (typeof SIGN_OUT_REASONS)[number];

// 值就是登出的原因；有值 = 這個分頁已登出
const SIGNED_OUT_KEY = "msl:signed-out-here";
// 標記改變時通知同一個分頁裡的畫面（sessionStorage 的 storage 事件只會發給其他分頁）
const CHANGE_EVENT = "msl:signed-out-change";

/** 這個分頁登出的原因；沒有登出回傳 null */
export function getSignOutReason(): SignOutReason | null {
  try {
    const value = sessionStorage.getItem(SIGNED_OUT_KEY);
    return SIGN_OUT_REASONS.includes(value as SignOutReason) ? (value as SignOutReason) : null;
  } catch {
    return null; // 無痕模式等情況存取 sessionStorage 可能丟錯：當成沒有標記
  }
}

/** 這個分頁是否已登出（被其他分頁的登入取代、或被踢下線） */
export const isSignedOutHere = () => getSignOutReason() !== null;

export function markSignedOutHere(reason: SignOutReason) {
  try {
    sessionStorage.setItem(SIGNED_OUT_KEY, reason);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // 寫不進去就算了，至少這次已經導向登入頁
  }
}

export function clearSignedOutHere() {
  try {
    sessionStorage.removeItem(SIGNED_OUT_KEY);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // 同上
  }
}

/** 給 useSyncExternalStore 用：標記改變時通知 */
export function subscribeSignOut(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CHANGE_EVENT, onChange);
}

/** 分頁之間的訊息 */
type TabMessage = { type: "signed-in"; from: string };

const CHANNEL = "msl-auth";

/** 這個分頁的 id：同一個分頁裡的其他頻道物件也會收到廣播，用來忽略自己發的 */
const TAB_ID =
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random());

/** 通知其他分頁：「這個分頁剛登入了」 */
export function announceSignedIn() {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(CHANNEL);
  channel.postMessage({ type: "signed-in", from: TAB_ID } satisfies TabMessage);
  channel.close();
}

/** 監聽「其他分頁登入了」，回傳取消監聽的函式 */
export function onOtherTabSignedIn(handler: () => void): () => void {
  if (typeof BroadcastChannel === "undefined") return () => {};
  const channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = (event: MessageEvent<TabMessage>) => {
    if (event.data?.type === "signed-in" && event.data.from !== TAB_ID) handler();
  };
  return () => channel.close();
}
