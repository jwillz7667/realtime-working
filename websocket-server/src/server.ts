import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import dotenv from "dotenv";
import http from "http";
import { readFileSync } from "fs";
import { join } from "path";
import {
  handleCallConnection,
  handleFrontendConnection,
} from "./sessionManager";
import functions from "./functionHandlers";

// Security and Auth Middleware
import { applySecurityMiddleware, errorHandler } from "./middleware/security";
import { apiRateLimiter, callRateLimiter, websocketRateLimiter } from "./middleware/rateLimit";
import { authenticateWebSocket } from "./middleware/auth";

// API Routes
import apiKeysRouter from "./routes/apiKeys";

dotenv.config();

const PORT = parseInt(process.env.PORT || "8081", 10);
const PUBLIC_URL = process.env.PUBLIC_URL || "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

// Validate required environment variables
if (!OPENAI_API_KEY) {
  console.error("[Error] OPENAI_API_KEY environment variable is required");
  process.exit(1);
}

// Optional Supabase config (required for auth features)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const authEnabled = Boolean(SUPABASE_URL && SUPABASE_SERVICE_KEY);

if (!authEnabled) {
  console.warn("[Warning] Authentication disabled: SUPABASE_URL and SUPABASE_SERVICE_KEY not configured");
  console.warn("[Warning] Running in legacy mode without authentication");
} else {
  console.log("[Auth] Authentication enabled");
}

// =====================================================
// EXPRESS APP SETUP
// =====================================================

const app = express();

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Apply security middleware (helmet, CORS, request ID, etc.)
applySecurityMiddleware(app);

// =====================================================
// HTTP SERVER
// =====================================================

const server = http.createServer(app);

// =====================================================
// WEBSOCKET SERVER
// =====================================================

const wss = new WebSocketServer({
  server,
  // Custom verification for WebSocket connections
  verifyClient: (info: { origin: string; secure: boolean; req: IncomingMessage }, callback) => {
    const url = new URL(info.req.url || "", `http://${info.req.headers.host}`);
    const pathname = url.pathname;

    // Allow /call connections (Twilio webhook - no auth required)
    if (pathname.startsWith('/call')) {
      return callback(true);
    }

    // For /logs connections (frontend), require authentication if enabled
    if (pathname.startsWith('/logs') && authEnabled) {
      // Auth will be checked in connection handler
      return callback(true);
    }

    // Allow all in development or when auth is disabled
    if (process.env.NODE_ENV === 'development' || !authEnabled) {
      return callback(true);
    }

    // Default: allow
    callback(true);
  }
});

// =====================================================
// HTTP ENDPOINTS
// =====================================================

// Root endpoint - API information
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "OpenAI Realtime + Twilio Voice Server",
    version: "2.0.0",
    authEnabled,
    publicUrl: PUBLIC_URL,
    endpoints: {
      websocket: {
        logs: "/logs (requires auth)",
        call: "/call (Twilio webhook)"
      },
      http: {
        root: "/",
        health: "/health",
        publicUrl: "/public-url",
        twiml: "/twiml",
        tools: "/tools",
        apiKeys: "/api/apikeys (requires auth)"
      }
    }
  });
});

// Public URL endpoint
app.get("/public-url", (req, res) => {
  res.json({ publicUrl: PUBLIC_URL });
});

// TwiML endpoint for Twilio webhooks
app.all("/twiml", callRateLimiter, (req, res) => {
  try {
    const baseUrl = PUBLIC_URL || `${req.protocol}://${req.get("host")}`;
    if (!baseUrl) {
      throw new Error("No PUBLIC_URL configured and unable to infer host");
    }

    const wsUrl = new URL(baseUrl);
    wsUrl.protocol = wsUrl.protocol === "https:" ? "wss:" : "ws:";
    wsUrl.pathname = `/call`;

    const twimlPath = join(__dirname, "twiml.xml");
    const twimlTemplate = readFileSync(twimlPath, "utf-8");
    const twimlContent = twimlTemplate.replace("{{WS_URL}}", wsUrl.toString());

    res.type("text/xml").send(twimlContent);
  } catch (error) {
    console.error("[TwiML] Failed to generate TwiML", error);
    res
      .status(500)
      .type("text/plain")
      .send(
        "Server misconfigured. Set PUBLIC_URL to the externally reachable base URL (e.g. your ngrok https endpoint)."
      );
  }
});

// Tools endpoint - list available function schemas
app.get("/tools", apiRateLimiter, (req, res) => {
  res.json({
    data: functions.map((f) => f.schema),
    count: functions.length
  });
});

// =====================================================
// API ROUTES (AUTHENTICATED)
// =====================================================

if (authEnabled) {
  app.use("/api/apikeys", apiKeysRouter);
} else {
  // Return 503 for auth endpoints when auth is disabled
  app.use("/api/*", (req, res) => {
    res.status(503).json({
      error: {
        code: 'auth_disabled',
        message: 'Authentication features are disabled. Configure SUPABASE_URL and SUPABASE_SERVICE_KEY to enable.'
      }
    });
  });
}

// =====================================================
// WEBSOCKET CONNECTION HANDLING
// =====================================================

let currentCall: WebSocket | null = null;

wss.on("connection", async (ws: WebSocket, req: IncomingMessage) => {
  console.log(`[WebSocket] New connection from ${req.socket.remoteAddress}`);

  const url = new URL(req.url || "", `http://${req.headers.host}`);
  const pathname = url.pathname;
  const parts = pathname.split("/").filter(Boolean);

  if (parts.length < 1) {
    console.log(`[WebSocket] Closing - no path specified`);
    ws.close(1008, "Path required");
    return;
  }

  const type = parts[0];
  console.log(`[WebSocket] Connection type: ${type}`);

  if (type === "call") {
    // Twilio call connection - no auth required
    if (currentCall) {
      console.log("[WebSocket] Closing existing call connection");
      currentCall.close();
    }
    currentCall = ws;
    console.log(`[WebSocket] Handling Twilio call connection`);
    handleCallConnection(currentCall, OPENAI_API_KEY);

  } else if (type === "logs") {
    // Frontend logs connection - auth required if enabled
    if (authEnabled) {
      const user = await authenticateWebSocket(req, []);

      if (!user) {
        console.warn("[WebSocket] Unauthenticated logs connection rejected");
        ws.close(1008, "Authentication required");
        return;
      }

      console.log(`[WebSocket] Authenticated logs connection: ${user.email} (${user.tenantId})`);
      // Attach user to request for downstream handlers
      (req as any).user = user;
    } else {
      console.log(`[WebSocket] Logs connection (auth disabled)`);
    }

    handleFrontendConnection(ws);

  } else {
    console.log(`[WebSocket] Closing - unknown type: ${type}`);
    ws.close(1003, `Unknown connection type: ${type}`);
  }
});

wss.on("error", (error) => {
  console.error("[WebSocket] Server error:", error);
});

// =====================================================
// ERROR HANDLING
// =====================================================

// Global error handler (must be last)
app.use(errorHandler);

// =====================================================
// SERVER STARTUP
// =====================================================

server.listen(PORT, "0.0.0.0", () => {
  console.log("");
  console.log("=".repeat(60));
  console.log("  OpenAI Realtime + Twilio Voice Server");
  console.log("=".repeat(60));
  console.log(`  Status:       ✓ Running`);
  console.log(`  Port:         ${PORT}`);
  console.log(`  Local:        http://localhost:${PORT}`);
  console.log(`  Network:      http://0.0.0.0:${PORT}`);
  if (PUBLIC_URL) {
    console.log(`  Public URL:   ${PUBLIC_URL}`);
  }
  console.log(`  Auth:         ${authEnabled ? '✓ Enabled' : '✗ Disabled'}`);
  console.log(`  Environment:  ${process.env.NODE_ENV || 'development'}`);
  console.log("=".repeat(60));
  console.log("");
  console.log("  Endpoints:");
  console.log(`    GET  /              - API information`);
  console.log(`    GET  /health        - Health check`);
  console.log(`    GET  /tools         - List available tools`);
  console.log(`    POST /twiml         - Twilio webhook (generates TwiML)`);
  console.log(`    WS   /call          - Twilio call WebSocket`);
  console.log(`    WS   /logs          - Frontend logs WebSocket${authEnabled ? ' (auth required)' : ''}`);
  if (authEnabled) {
    console.log(`    API  /api/apikeys   - API key management (auth required)`);
  }
  console.log("=".repeat(60));
  console.log("");
});

// =====================================================
// GRACEFUL SHUTDOWN
// =====================================================

process.on("SIGTERM", () => {
  console.log("[Server] SIGTERM received, shutting down gracefully");
  server.close(() => {
    console.log("[Server] HTTP server closed");
    wss.close(() => {
      console.log("[WebSocket] WebSocket server closed");
      process.exit(0);
    });
  });
});

process.on("SIGINT", () => {
  console.log("[Server] SIGINT received, shutting down gracefully");
  server.close(() => {
    console.log("[Server] HTTP server closed");
    wss.close(() => {
      console.log("[WebSocket] WebSocket server closed");
      process.exit(0);
    });
  });
});
