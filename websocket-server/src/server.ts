import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import dotenv from "dotenv";
import http from "http";
import { readFileSync } from "fs";
import { join } from "path";
import cors from "cors";
import {
  handleCallConnection,
  handleFrontendConnection,
} from "./sessionManager";
import functions from "./functionHandlers";

dotenv.config();

const PORT = parseInt(process.env.PORT || "8081", 10);
const PUBLIC_URL = process.env.PUBLIC_URL || "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

if (!OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY environment variable is required");
  process.exit(1);
}

const app = express();
app.use(cors());
const server = http.createServer(app);
const wss = new WebSocketServer({
  server,
  // Allow all origins for WebSocket connections
  verifyClient: (info: { origin: string; secure: boolean; req: IncomingMessage }) => {
    // Accept all origins in development
    return true;
  }
});

app.use(express.urlencoded({ extended: false }));

const twimlPath = join(__dirname, "twiml.xml");
const twimlTemplate = readFileSync(twimlPath, "utf-8");

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "WebSocket server is running",
    publicUrl: PUBLIC_URL,
    endpoints: {
      websocket: {
        logs: "/logs",
        call: "/call"
      },
      http: {
        publicUrl: "/public-url",
        twiml: "/twiml",
        tools: "/tools"
      }
    }
  });
});

app.get("/public-url", (req, res) => {
  res.json({ publicUrl: PUBLIC_URL });
});

app.all("/twiml", (req, res) => {
  try {
    const baseUrl = PUBLIC_URL || `${req.protocol}://${req.get("host")}`;
    if (!baseUrl) {
      throw new Error("No PUBLIC_URL configured and unable to infer host");
    }

    const wsUrl = new URL(baseUrl);
    wsUrl.protocol = wsUrl.protocol === "https:" ? "wss:" : "ws:";
    wsUrl.pathname = `/call`;

    const twimlContent = twimlTemplate.replace("{{WS_URL}}", wsUrl.toString());
    res.type("text/xml").send(twimlContent);
  } catch (error) {
    console.error("Failed to generate TwiML", error);
    res
      .status(500)
      .type("text/plain")
      .send(
        "Server misconfigured. Set PUBLIC_URL to the externally reachable base URL (e.g. your ngrok https endpoint)."
      );
  }
});

// New endpoint to list available tools (schemas)
app.get("/tools", (req, res) => {
  res.json(functions.map((f) => f.schema));
});

let currentCall: WebSocket | null = null;

wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
  console.log(`[WebSocket] New connection attempt from ${req.headers.origin || 'unknown'}`);
  console.log(`[WebSocket] Path: ${req.url}`);
  console.log(`[WebSocket] Headers:`, {
    host: req.headers.host,
    upgrade: req.headers.upgrade,
    connection: req.headers.connection,
    origin: req.headers.origin
  });

  const url = new URL(req.url || "", `http://${req.headers.host}`);
  const parts = url.pathname.split("/").filter(Boolean);

  if (parts.length < 1) {
    console.log(`[WebSocket] Closing - no path specified`);
    ws.close();
    return;
  }

  const type = parts[0];
  console.log(`[WebSocket] Connection type: ${type}`);

  if (type === "call") {
    if (currentCall) currentCall.close();
    currentCall = ws;
    console.log(`[WebSocket] Handling call connection`);
    handleCallConnection(currentCall, OPENAI_API_KEY);
  } else if (type === "logs") {
    console.log(`[WebSocket] Handling frontend logs connection`);
    handleFrontendConnection(ws);
  } else {
    console.log(`[WebSocket] Closing - unknown type: ${type}`);
    ws.close();
  }
});

wss.on("error", (error) => {
  console.error("[WebSocket] Server error:", error);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  console.log(`Accessible via http://localhost:${PORT}`);
  if (PUBLIC_URL) {
    console.log(`Public URL: ${PUBLIC_URL}`);
  }
});
