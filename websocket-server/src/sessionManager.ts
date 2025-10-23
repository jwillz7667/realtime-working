import { RawData, WebSocket } from "ws";
import functions from "./functionHandlers";
import {
  REALTIME_SERVER_EVENT_TYPES,
  isRealtimeClientEventType,
} from "./realtimeEvents";
import {
  REALTIME_MODEL,
  REALTIME_BETA_HEADER,
  buildDefaultSessionConfig,
  normalizeTurnDetectionConfig,
} from "./config";

const PENDING_COMMIT_DELAY_MS = 120;
const SAMPLE_RATE_HZ = 8000; // Twilio streams 8kHz µ-law audio
const BYTES_PER_SAMPLE = 1; // µ-law is 8-bit so one byte per sample
const MIN_COMMIT_DURATION_MS = 120;
const MIN_COMMIT_BYTES = Math.ceil(
  (SAMPLE_RATE_HZ * MIN_COMMIT_DURATION_MS) / 1000 * BYTES_PER_SAMPLE
);

const SUPPRESSED_MODEL_EVENTS = new Set([
  "response.audio.delta",
  "response.audio.done",
  "response.audio_transcript.delta",
  "response.audio_transcript.done",
  "response.output_audio.delta",
  "response.output_audio.done",
  "response.output_audio_transcript.delta",
  "response.output_audio_transcript.done",
]);

const DOCUMENTED_MODEL_EVENTS = new Set<string>(REALTIME_SERVER_EVENT_TYPES);

const KNOWN_UNDOCUMENTED_MODEL_EVENTS = new Set([
  "conversation.created",
  "conversation.item.created",
  "conversation.item.added",
  "conversation.item.done",
  "mcp_list_tools.completed",
  "mcp_list_tools.failed",
  "mcp_list_tools.in_progress",
  "rate_limits.updated",
  "response.content_part.added",
  "response.content_part.done",
  "response.function_call_arguments.delta",
  "response.function_call_arguments.done",
  "response.mcp_call.completed",
  "response.mcp_call.failed",
  "response.mcp_call.in_progress",
  "response.mcp_call_arguments.delta",
  "response.mcp_call_arguments.done",
  "response.output_audio.delta",
  "response.output_audio.done",
  "response.output_audio_transcript.delta",
  "response.output_audio_transcript.done",
  "response.output_text.delta",
  "response.output_text.done",
  "response.text.delta",
  "response.text.done",
  "transcription_session.update",
  "transcription_session.updated",
]);

interface Session {
  twilioConn?: WebSocket;
  frontendConns?: Set<WebSocket>;
  modelConn?: WebSocket;
  streamSid?: string;
  callSid?: string;
  saved_config?: any;
  lastAssistantItem?: string;
  responseStartTimestamp?: number;
  latestMediaTimestamp?: number;
  openAIApiKey?: string;
  activeModel?: string;
  reconnectTimer?: NodeJS.Timeout;
  pendingCommitTimer?: NodeJS.Timeout;
  hasBufferedAudio?: boolean;
  pendingAudioByteCount?: number;
  responseInProgress?: boolean;
  responseCreateQueued?: boolean;
  responseCreateForceQueued?: boolean;
  committedAudioPending?: boolean;
}

let session: Session = {};

export function handleCallConnection(ws: WebSocket, openAIApiKey: string) {
  cleanupConnection(session.twilioConn);
  session.twilioConn = ws;
  session.openAIApiKey = openAIApiKey;

  ws.on("message", handleTwilioMessage);
  ws.on("error", ws.close);
  ws.on("close", () => {
    cleanupConnection(session.modelConn);
    cleanupConnection(session.twilioConn);
    session.twilioConn = undefined;
    session.modelConn = undefined;
    session.streamSid = undefined;
    session.lastAssistantItem = undefined;
    session.responseStartTimestamp = undefined;
    session.latestMediaTimestamp = undefined;
    if (!session.frontendConns || session.frontendConns.size === 0)
      session = {};
  });
}

const AUDIO_FORMAT_ALIASES: Record<string, string> = {
  pcm16: "audio/pcm",
  "audio/pcm": "audio/pcm",
  "audio/pcm16": "audio/pcm",
  "audio/raw": "audio/pcm",
  linear16: "audio/pcm",
  "audio/linear16": "audio/pcm",
  g711_ulaw: "audio/pcmu",
  "audio/pcmu": "audio/pcmu",
  "pcmu": "audio/pcmu",
  mulaw: "audio/pcmu",
  "audio/mulaw": "audio/pcmu",
  "audio/x-mulaw": "audio/pcmu",
  g711_alaw: "audio/pcma",
  "audio/pcma": "audio/pcma",
  pcma: "audio/pcma",
  alaw: "audio/pcma",
  "audio/alaw": "audio/pcma",
};

function normalizeAudioFormat(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    const mapped = AUDIO_FORMAT_ALIASES[normalized];
    if (mapped) return mapped;
    return undefined;
  }
  if (typeof value === "object") {
    const maybeType = (value as { type?: unknown }).type;
    if (typeof maybeType === "string") {
      return normalizeAudioFormat(maybeType);
    }
  }
  return undefined;
}

function sanitizeSessionUpdatePayload(sessionUpdate: any) {
  if (!sessionUpdate || typeof sessionUpdate !== "object") {
    return {};
  }

  const {
    type: sessionType,
    mcp_server_connections,
    audio,
    max_output_tokens,
    input_audio_format,
    output_audio_format,
    input_audio_transcription,
    input_audio_noise_reduction,
    voice,
    turn_detection,
    ...rest
  } = sessionUpdate;

  const sanitized: Record<string, any> = { ...rest };

  const normalizedType =
    typeof sessionType === "string" && sessionType.trim()
      ? sessionType.trim()
      : undefined;
  if (normalizedType) {
    sanitized.type = normalizedType;
  } else if (!sanitized.type) {
    sanitized.type = "realtime";
  }

  if (sanitized.modalities !== undefined) {
    delete sanitized.modalities;
  }

  if (
    mcp_server_connections &&
    Array.isArray(mcp_server_connections) &&
    mcp_server_connections.length === 0
  ) {
    delete sanitized.mcp_server_connections;
  }

  const audioInput = sanitizeAudioInputConfig({
    format: audio?.input?.format ?? input_audio_format,
    transcription: audio?.input?.transcription ?? input_audio_transcription,
    noiseReduction: audio?.input?.noise_reduction ?? input_audio_noise_reduction,
    turnDetection: audio?.input?.turn_detection ?? turn_detection,
  });

  const audioOutput = sanitizeAudioOutputConfig({
    format: audio?.output?.format ?? output_audio_format,
    voice: audio?.output?.voice ?? voice,
  });

  const sanitizedAudio: Record<string, any> = {};
  if (audioInput) {
    sanitizedAudio.input = audioInput;
  }
  if (audioOutput) {
    sanitizedAudio.output = audioOutput;
  }

  if (audio && typeof audio === "object") {
    if (!sanitizedAudio.input && audio.input) {
      sanitizedAudio.input = audio.input;
    }
    if (!sanitizedAudio.output && audio.output) {
      sanitizedAudio.output = audio.output;
    }
  }

  if (Object.keys(sanitizedAudio).length > 0) {
    sanitized.audio = sanitizedAudio;
  }

  if (typeof max_output_tokens !== "undefined") {
    sanitized.max_response_output_tokens = max_output_tokens;
  }
  if (typeof sanitized.max_output_tokens !== "undefined") {
    sanitized.max_response_output_tokens = sanitized.max_output_tokens;
    delete sanitized.max_output_tokens;
  }

  return sanitized;
}

function sanitizeAudioFormatConfig(value: unknown) {
  const normalizedType = normalizeAudioFormat(value);
  if (!normalizedType) {
    return undefined;
  }

  const sanitized: Record<string, any> = { type: normalizedType };

  return sanitized;
}

function sanitizeAudioInputConfig(params: {
  format?: unknown;
  transcription?: unknown;
  noiseReduction?: unknown;
  turnDetection?: unknown;
}) {
  const { format, transcription, noiseReduction, turnDetection } = params;

  const sanitized: Record<string, any> = {};

  const sanitizedFormat = sanitizeAudioFormatConfig(format);
  if (sanitizedFormat) {
    sanitized.format = sanitizedFormat;
  }

  if (transcription !== undefined) {
    sanitized.transcription = transcription;
  }

  if (noiseReduction !== undefined) {
    sanitized.noise_reduction = noiseReduction;
  }

  if (turnDetection !== undefined) {
    sanitized.turn_detection = normalizeTurnDetectionConfig(turnDetection);
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

function sanitizeAudioOutputConfig(params: { format?: unknown; voice?: unknown }) {
  const { format, voice } = params;

  const sanitized: Record<string, any> = {};

  const sanitizedFormat = sanitizeAudioFormatConfig(format);
  if (sanitizedFormat) {
    sanitized.format = sanitizedFormat;
  }

  if (typeof voice === "string" && voice.trim()) {
    sanitized.voice = voice.trim();
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

export function handleFrontendConnection(ws: WebSocket) {
  if (!session.frontendConns) {
    session.frontendConns = new Set();
  }
  session.frontendConns.add(ws);

  ws.on("message", handleFrontendMessage);
  ws.on("error", () => ws.close());
  jsonSend(ws, {
    type: "relay.hello",
    message: "Frontend subscribed to realtime event stream",
    timestamp: Date.now(),
  });
  ws.on("close", () => {
    if (session.frontendConns) {
      session.frontendConns.delete(ws);
      if (session.frontendConns.size === 0) {
        session.frontendConns = undefined;
      }
    }
    if (!session.twilioConn && !session.modelConn && !session.frontendConns) {
      session = {};
    }
  });
}

async function handleFunctionCall(item: { name: string; arguments: string }) {
  console.log("Handling function call:", item);
  const fnDef = functions.find((f) => f.schema.name === item.name);
  if (!fnDef) {
    throw new Error(`No handler found for function: ${item.name}`);
  }

  let args: unknown;
  try {
    args = JSON.parse(item.arguments);
  } catch {
    return JSON.stringify({
      error: "Invalid JSON arguments for function call.",
    });
  }

  try {
    console.log("Calling function:", fnDef.schema.name, args);
    const result = await fnDef.handler(args as any);
    return result;
  } catch (err: any) {
    console.error("Error running function:", err);
    return JSON.stringify({
      error: `Error running function ${item.name}: ${err.message}`,
    });
  }
}

function handleTwilioMessage(data: RawData) {
  const msg = parseMessage(data);
  if (!msg) return;

  switch (msg.event) {
    case "start":
      session.streamSid = msg.start.streamSid;
      session.callSid = msg.start.callSid;
      session.latestMediaTimestamp = 0;
      session.lastAssistantItem = undefined;
      session.responseStartTimestamp = undefined;
      session.hasBufferedAudio = false;
      session.pendingAudioByteCount = 0;
      session.responseInProgress = false;
      session.responseCreateQueued = false;
      session.responseCreateForceQueued = false;
      session.committedAudioPending = false;
      if (session.pendingCommitTimer) {
        clearTimeout(session.pendingCommitTimer);
        session.pendingCommitTimer = undefined;
      }
      tryConnectModel();
      broadcastToFrontends({
        type: "call.state",
        state: "active",
        callSid: session.callSid,
        recording: { status: "idle" },
      });
      break;
    case "media":
      session.latestMediaTimestamp = msg.media.timestamp;
      if (isOpen(session.modelConn)) {
        const decoded = Buffer.from(msg.media.payload, "base64");
        if (decoded.length === 0) {
          break;
        }
        sendOpenAIEvent({
          type: "input_audio_buffer.append",
          audio: msg.media.payload,
        });
        session.hasBufferedAudio = true;
        session.pendingAudioByteCount =
          (session.pendingAudioByteCount || 0) + decoded.length;
        schedulePendingCommit();
      }
      break;
    case "close":
      flushPendingAudio({ force: true });
      closeAllConnections();
      break;
  }
}

function schedulePendingCommit() {
  if (!session.hasBufferedAudio || !isOpen(session.modelConn)) {
    return;
  }

  if (session.pendingCommitTimer) {
    clearTimeout(session.pendingCommitTimer);
  }

  session.pendingCommitTimer = setTimeout(() => {
    session.pendingCommitTimer = undefined;
    flushPendingAudio();
  }, PENDING_COMMIT_DELAY_MS);
}

function flushPendingAudio(options: { force?: boolean } = {}) {
  if (session.pendingCommitTimer) {
    clearTimeout(session.pendingCommitTimer);
    session.pendingCommitTimer = undefined;
  }

  const pendingBytes = session.pendingAudioByteCount || 0;

  if (!session.hasBufferedAudio || pendingBytes === 0) {
    return;
  }

  if (pendingBytes < MIN_COMMIT_BYTES) {
    if (options.force) {
      session.hasBufferedAudio = false;
      session.pendingAudioByteCount = 0;
    } else {
      schedulePendingCommit();
    }
    return;
  }

  session.hasBufferedAudio = false;
  session.pendingAudioByteCount = 0;

  if (!isOpen(session.modelConn)) {
    return;
  }

  sendOpenAIEvent({ type: "input_audio_buffer.commit" });
  session.committedAudioPending = true;
  requestResponseCreate();
}

function handleFrontendMessage(data: RawData) {
  const msg = parseMessage(data);
  if (!msg) return;

  if (msg.type === "session.update") {
    const sanitized = sanitizeSessionUpdatePayload(msg.session);
    session.saved_config = sanitized;
    if (isOpen(session.modelConn)) {
      const requestedModel =
        typeof sanitized.model === "string" ? sanitized.model : undefined;
      if (requestedModel && requestedModel !== session.activeModel) {
        console.info(
          `[Realtime] Model change requested (${session.activeModel || "(default)"} -> ${requestedModel}), restarting connection`
        );
        session.modelConn.close();
        return;
      }

      const { model: _ignoredModel, ...sessionWithoutModel } = sanitized;
      sendOpenAIEvent({ ...msg, session: sessionWithoutModel });
    }
    return;
  }

  if (isOpen(session.modelConn)) {
    sendOpenAIEvent(msg);
  }
}

function tryConnectModel() {
  if (!session.twilioConn || !session.streamSid || !session.openAIApiKey)
    return;
  if (isOpen(session.modelConn)) return;

  if (session.reconnectTimer) {
    clearTimeout(session.reconnectTimer);
    session.reconnectTimer = undefined;
  }

  const overrides = session.saved_config || {};
  const requestedModel =
    typeof overrides.model === "string" && overrides.model.trim()
      ? overrides.model.trim()
      : REALTIME_MODEL;

  console.info(
    `[Realtime] Connecting to OpenAI model ${requestedModel} for stream ${session.streamSid}`
  );

  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.openAIApiKey}`,
  };

  if (REALTIME_BETA_HEADER) {
    headers["OpenAI-Beta"] = REALTIME_BETA_HEADER;
  }

  session.modelConn = new WebSocket(
    `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(requestedModel)}`,
    "realtime",
    {
      headers,
    }
  );

  session.modelConn.on("open", () => {
    console.info("[Realtime] Connected to OpenAI model websocket");
    session.activeModel = requestedModel;
    const overridesCurrent = session.saved_config || {};
    const defaults = buildDefaultSessionConfig();
    const overridesWithoutModel = { ...overridesCurrent };
    delete overridesWithoutModel.model;
    delete overridesWithoutModel.modalities;

    const mergedAudio = {
      input: {
        ...defaults.audio.input,
        ...(overridesCurrent.audio?.input || {}),
        format: {
          ...defaults.audio.input.format,
          ...(overridesCurrent.audio?.input?.format || {}),
        },
        transcription:
          overridesCurrent.audio?.input?.transcription ??
          defaults.audio.input.transcription,
        noise_reduction:
          overridesCurrent.audio?.input?.noise_reduction ??
          defaults.audio.input.noise_reduction,
        turn_detection: normalizeTurnDetectionConfig(
          overridesCurrent.audio?.input?.turn_detection ||
            defaults.audio.input.turn_detection
        ),
      },
      output: {
        ...defaults.audio.output,
        ...(overridesCurrent.audio?.output || {}),
        format: {
          ...defaults.audio.output.format,
          ...(overridesCurrent.audio?.output?.format || {}),
        },
        voice:
          overridesCurrent.audio?.output?.voice || defaults.audio.output.voice,
      },
    };

    const sessionPayload = {
      ...defaults,
      ...overridesWithoutModel,
      type: "realtime", // retained for local use but stripped before sending
      model: requestedModel,
      instructions: overridesCurrent.instructions || defaults.instructions,
      tool_choice: overridesCurrent.tool_choice || defaults.tool_choice,
      tools: overridesCurrent.tools ?? defaults.tools,
      ...(overridesCurrent.mcp_server_connections?.length
        ? { mcp_server_connections: overridesCurrent.mcp_server_connections }
        : defaults.mcp_server_connections?.length
        ? { mcp_server_connections: defaults.mcp_server_connections }
        : {}),
      audio: mergedAudio,
    };

    const sanitizedPayload = sanitizeSessionUpdatePayload(sessionPayload);

    sendOpenAIEvent({
      type: "session.update",
      session: sanitizedPayload,
    });
  });

  session.modelConn.on("message", handleModelMessage);
  session.modelConn.on("error", (err) => {
    console.error("[Realtime] Model websocket error", err);
    closeModel();
  });
  session.modelConn.on("close", (code, reason) => {
    const reasonText =
      typeof reason === "string"
        ? reason
        : reason instanceof Buffer
        ? reason.toString()
        : undefined;
    console.warn("[Realtime] Model websocket closed", {
      code,
      reason: reasonText,
    });
    closeModel();
  });
}

function handleModelMessage(data: RawData) {
  const event = parseMessage(data);
  if (!event) return;

  if (event.type === "error") {
    const errorCode = event.error?.code;
    if (errorCode === "input_audio_buffer_commit_empty") {
      console.debug(
        "[Realtime] OpenAI rejected empty audio commit; waiting for more audio",
      );
      session.hasBufferedAudio = false;
      session.pendingAudioByteCount = 0;
      session.committedAudioPending = false;
    } else if (errorCode === "conversation_already_has_active_response") {
      session.responseInProgress = true;
      session.responseCreateQueued = true;
      console.debug(
        "[Realtime] Response already in progress; queued follow-up response"
      );
    } else {
      console.error("[Realtime] OpenAI error event", event);
    }
  }

  broadcastToFrontends(event);

  switch (event.type) {
    case "input_audio_buffer.speech_started":
      handleTruncation();
      break;

    case "response.output_audio.delta":
      if (session.twilioConn && session.streamSid) {
        if (session.responseStartTimestamp === undefined) {
          session.responseStartTimestamp = session.latestMediaTimestamp || 0;
        }
        if (event.item_id) session.lastAssistantItem = event.item_id;

        jsonSend(session.twilioConn, {
          event: "media",
          streamSid: session.streamSid,
          media: { payload: event.delta },
        });

        jsonSend(session.twilioConn, {
          event: "mark",
          streamSid: session.streamSid,
        });
      }
      break;

    case "response.output_audio_transcript.delta":
      // Transcript chunks for assistant audio; feed through to frontend
      break;

    case "response.output_text.delta":
      break;

    case "response.created":
      session.responseInProgress = true;
      if (!session.responseCreateForceQueued) {
        session.committedAudioPending = false;
      }
      break;

    case "response.done":
      session.responseInProgress = false;
      if (session.responseCreateQueued) {
        requestResponseCreate({ force: session.responseCreateForceQueued });
      }
      session.responseCreateQueued = false;
      session.responseCreateForceQueued = false;
      break;

    case "response.output_item.done": {
      const { item } = event;
      if (item.type === "function_call") {
        handleFunctionCall(item)
          .then((output) => {
            if (session.modelConn) {
              const serializedOutput =
                typeof output === "string" ? output : JSON.stringify(output);
              sendOpenAIEvent({
                type: "conversation.item.create",
                item: {
                  object: "realtime.item",
                  type: "function_call_output",
                  call_id: item.call_id,
                  status: "completed",
                  output: serializedOutput,
                },
              });
              requestResponseCreate({ force: true });
            }
          })
          .catch((err) => {
            console.error("Error handling function call:", err);
          });
      }
      break;
    }
    default:
      if (
        !SUPPRESSED_MODEL_EVENTS.has(event.type) &&
        !DOCUMENTED_MODEL_EVENTS.has(event.type) &&
        !KNOWN_UNDOCUMENTED_MODEL_EVENTS.has(event.type)
      ) {
        console.debug("[Realtime] Unhandled model event", event.type);
      }
      break;
  }
}

function handleTruncation() {
  if (
    !session.lastAssistantItem ||
    session.responseStartTimestamp === undefined
  )
    return;

  const elapsedMs =
    (session.latestMediaTimestamp || 0) - (session.responseStartTimestamp || 0);
  const audio_end_ms = elapsedMs > 0 ? elapsedMs : 0;

  if (isOpen(session.modelConn)) {
    sendOpenAIEvent({
      type: "conversation.item.truncate",
      item_id: session.lastAssistantItem,
      content_index: 0,
      audio_end_ms,
    });
  }

  if (session.twilioConn && session.streamSid) {
    jsonSend(session.twilioConn, {
      event: "clear",
      streamSid: session.streamSid,
    });
  }

  session.lastAssistantItem = undefined;
  session.responseStartTimestamp = undefined;
}

function closeModel() {
  cleanupConnection(session.modelConn);
  session.modelConn = undefined;
  session.activeModel = undefined;
  broadcastToFrontends({
    type: "call.state",
    state: "model_disconnected",
    callSid: session.callSid,
    recording: { status: "idle" },
  });
  if (session.reconnectTimer) {
    clearTimeout(session.reconnectTimer);
    session.reconnectTimer = undefined;
  }

  if (session.twilioConn && session.twilioConn.readyState === WebSocket.OPEN) {
    session.reconnectTimer = setTimeout(() => {
      session.reconnectTimer = undefined;
      tryConnectModel();
    }, 200);
  }

  if (!session.twilioConn && !session.frontendConns) session = {};
}

function closeAllConnections() {
  broadcastToFrontends({
    type: "call.state",
    state: "disconnected",
    callSid: session.callSid,
    recording: { status: "idle" },
  });
  if (session.twilioConn) {
    session.twilioConn.close();
    session.twilioConn = undefined;
  }
  if (session.modelConn) {
    session.modelConn.close();
    session.modelConn = undefined;
  }
  if (session.frontendConns) {
    for (const conn of session.frontendConns) {
      conn.close();
    }
    session.frontendConns.clear();
    session.frontendConns = undefined;
  }
  session.streamSid = undefined;
  session.lastAssistantItem = undefined;
  session.responseStartTimestamp = undefined;
  session.latestMediaTimestamp = undefined;
  session.saved_config = undefined;
  session.callSid = undefined;
  session.responseInProgress = undefined;
  session.responseCreateQueued = undefined;
  session.responseCreateForceQueued = undefined;
  session.committedAudioPending = undefined;
  if (session.pendingCommitTimer) {
    clearTimeout(session.pendingCommitTimer);
    session.pendingCommitTimer = undefined;
  }
  session.hasBufferedAudio = false;
  session.pendingAudioByteCount = 0;
}

function cleanupConnection(ws?: WebSocket) {
  if (isOpen(ws)) ws.close();
}

function parseMessage(data: RawData): any {
  try {
    return JSON.parse(data.toString());
  } catch {
    return null;
  }
}

function jsonSend(ws: WebSocket | undefined, obj: unknown) {
  if (!isOpen(ws)) return;
  ws.send(JSON.stringify(obj));
}

function broadcastToFrontends(obj: unknown) {
  if (!session.frontendConns || session.frontendConns.size === 0) {
    return;
  }
  for (const conn of session.frontendConns) {
    jsonSend(conn, obj);
  }
}

function requestResponseCreate(options: { force?: boolean } = {}) {
  if (!isOpen(session.modelConn)) {
    return;
  }

  const force = !!options.force;

  if (!force && !session.committedAudioPending) {
    return;
  }

  if (session.responseInProgress) {
    session.responseCreateQueued = true;
    if (force) {
      session.responseCreateForceQueued = true;
    }
    return;
  }

  session.responseInProgress = true;
  session.responseCreateQueued = false;
  session.responseCreateForceQueued = force;
  if (!force) {
    session.committedAudioPending = false;
  }
  sendOpenAIEvent({ type: "response.create" });
}

function sendOpenAIEvent(event: any) {
  if (!event || typeof event !== "object") {
    console.warn("[Realtime] Ignoring malformed OpenAI event payload", event);
    return;
  }
  if (!("type" in event) || typeof event.type !== "string") {
    console.warn("[Realtime] Missing event.type field", event);
    return;
  }
  if (!isRealtimeClientEventType(event.type)) {
    console.warn("[Realtime] Unsupported OpenAI event type", event.type, event);
    return;
  }
  jsonSend(session.modelConn, event);
}

function isOpen(ws?: WebSocket): ws is WebSocket {
  return !!ws && ws.readyState === WebSocket.OPEN;
}
