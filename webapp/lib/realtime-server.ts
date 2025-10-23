const ENV_BASE =
  process.env.NEXT_PUBLIC_REALTIME_SERVER_URL ||
  process.env.REALTIME_SERVER_URL;

const FALLBACK_BASE = "http://localhost:8081";

function ensureAbsoluteBase() {
  return (ENV_BASE || FALLBACK_BASE).replace(/\/$/, "");
}

function normalizePath(path: string) {
  if (!path) return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

export function getRealtimeHttpUrl(path: string) {
  const base = ensureAbsoluteBase();
  const normalized = normalizePath(path);
  const url = new URL(normalized, base);
  return url.toString();
}

export function getRealtimeWsUrl(path: string) {
  const httpUrl = getRealtimeHttpUrl(path);
  const wsUrl = new URL(httpUrl);
  wsUrl.protocol = wsUrl.protocol === "https:" ? "wss:" : "ws:";
  wsUrl.search = "";
  wsUrl.hash = "";
  return wsUrl.toString();
}
