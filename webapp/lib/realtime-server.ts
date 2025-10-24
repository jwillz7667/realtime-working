const ENV_BASE =
  process.env.NEXT_PUBLIC_REALTIME_SERVER_URL ||
  process.env.REALTIME_SERVER_URL;

const FALLBACK_BASE = "http://localhost:8081";

function ensureAbsoluteBase() {
  const base = (ENV_BASE || FALLBACK_BASE).trim().replace(/\/$/, "");
  if (!base) {
    console.error("[realtime-server] No base URL configured, using fallback");
    return FALLBACK_BASE;
  }
  return base;
}

function normalizePath(path: string) {
  if (!path) return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

export function getRealtimeHttpUrl(path: string) {
  const base = ensureAbsoluteBase();
  const normalized = normalizePath(path);

  console.log("[realtime-server] Constructing URL:", { base, path, normalized });

  try {
    const url = new URL(normalized, base);
    return url.toString();
  } catch (error) {
    console.error("[realtime-server] Failed to construct URL:", {
      base,
      normalized,
      ENV_BASE,
      FALLBACK_BASE,
      error
    });
    throw error;
  }
}

export function getRealtimeWsUrl(path: string) {
  const httpUrl = getRealtimeHttpUrl(path);
  const wsUrl = new URL(httpUrl);
  wsUrl.protocol = wsUrl.protocol === "https:" ? "wss:" : "ws:";
  wsUrl.search = "";
  wsUrl.hash = "";
  return wsUrl.toString();
}
