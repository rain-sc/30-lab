// 全站共用的 STOMP 連線（瀏覽器直連後端 NEXT_PUBLIC_WS_URL，不經過 Next.js 轉發）
// - 只建一條連線，所有訂閱共用（帳號通知、之後的開獎倒數 / 開獎結果）
// - 斷線自動重連（5 秒起，指數拉長到最長 1 分鐘）；每次連上都把目前的訂閱重新訂閱一次
// - 身分在握手時由後端讀 HttpOnly cookie 決定：登入、註冊、登出後要 restartWs() 重新握手
import { Client, ReconnectionTimeMode, type IMessage } from "@stomp/stompjs";

/**
 * WebSocket 位址：有設定 NEXT_PUBLIC_WS_URL（正式環境）就用設定；
 * 沒設定（本機開發）就用目前頁面的主機名稱 + 後端的 8088 port。
 * 不能寫死 localhost：用區網 IP 開網站時（例如手機開 http://192.168.0.171:3100），
 * localhost 指的是手機自己；而且 cookie 綁的是頁面的主機名稱，連到 localhost 不會帶 cookie，後端認不出身分。
 */
function wsUrl() {
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.hostname}:8088/ws`;
}

type Subscription = {
  destination: string;
  onMessage: (body: unknown) => void;
  unsubscribe?: () => void;
};

let client: Client | null = null;
const subscriptions = new Set<Subscription>();
/** 每次連上（含重連）時通知：斷線期間可能漏掉推播，要重新抓一次資料 */
const connectListeners = new Set<() => void>();

function parse(message: IMessage): unknown {
  try {
    return JSON.parse(message.body);
  } catch {
    return message.body;
  }
}

function attach(sub: Subscription) {
  if (!client?.connected) return;
  const stomp = client.subscribe(sub.destination, (message) => sub.onMessage(parse(message)));
  sub.unsubscribe = () => stomp.unsubscribe();
}

function getClient(): Client {
  if (!client) {
    client = new Client({
      brokerURL: wsUrl(),
      reconnectDelay: 5000,
      reconnectTimeMode: ReconnectionTimeMode.EXPONENTIAL,
      maxReconnectDelay: 60000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      onConnect: () => {
        subscriptions.forEach(attach);
        connectListeners.forEach((listener) => listener());
      },
    });
  }
  return client;
}

/** 每次連上（含重連）時呼叫 listener，回傳取消的函式 */
export function onWsConnect(listener: () => void): () => void {
  connectListeners.add(listener);
  return () => connectListeners.delete(listener);
}

/** 開始連線（重複呼叫沒關係） */
export function startWs() {
  const c = getClient();
  if (!c.active) c.activate();
}

/** 斷線，不再自動重連（這個分頁登出時） */
export function stopWs() {
  void client?.deactivate({ force: true });
}

/**
 * 斷線重連：登入、註冊、登出後呼叫，讓後端用新的 cookie 重新識別身分。
 * force：直接關掉舊連線、不等伺服器回覆 DISCONNECT，否則新身分的連線建立前會漏收推播
 */
export async function restartWs() {
  const c = getClient();
  await c.deactivate({ force: true });
  c.activate();
}

/** 訂閱一個 destination，回傳取消訂閱的函式；還沒連上也可以先訂閱，連上（和每次重連）時會自動生效 */
export function subscribeWs(destination: string, onMessage: (body: unknown) => void): () => void {
  const sub: Subscription = { destination, onMessage };
  subscriptions.add(sub);
  attach(sub);
  return () => {
    subscriptions.delete(sub);
    sub.unsubscribe?.();
  };
}
