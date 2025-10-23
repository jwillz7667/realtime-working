"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleCallConnection = handleCallConnection;
exports.handleFrontendConnection = handleFrontendConnection;
const ws_1 = require("ws");
const functionHandlers_1 = __importDefault(require("./functionHandlers"));
const realtimeEvents_1 = require("./realtimeEvents");
const config_1 = require("./config");
const PENDING_COMMIT_DELAY_MS = 120;
const SAMPLE_RATE_HZ = 8000; // Twilio streams 8kHz µ-law audio
const BYTES_PER_SAMPLE = 1; // µ-law is 8-bit so one byte per sample
const MIN_COMMIT_DURATION_MS = 120;
const MIN_COMMIT_BYTES = Math.ceil((SAMPLE_RATE_HZ * MIN_COMMIT_DURATION_MS) / 1000 * BYTES_PER_SAMPLE);
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
const DOCUMENTED_MODEL_EVENTS = new Set(realtimeEvents_1.REALTIME_SERVER_EVENT_TYPES);
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
let session = {};
function handleCallConnection(ws, openAIApiKey) {
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
const AUDIO_FORMAT_ALIASES = {
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
function normalizeAudioFormat(value) {
    if (!value)
        return undefined;
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        const mapped = AUDIO_FORMAT_ALIASES[normalized];
        if (mapped)
            return mapped;
        return undefined;
    }
    if (typeof value === "object") {
        const maybeType = value.type;
        if (typeof maybeType === "string") {
            return normalizeAudioFormat(maybeType);
        }
    }
    return undefined;
}
function sanitizeSessionUpdatePayload(sessionUpdate) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    if (!sessionUpdate || typeof sessionUpdate !== "object") {
        return {};
    }
    const { type: sessionType, mcp_server_connections, audio, max_output_tokens, input_audio_format, output_audio_format, input_audio_transcription, input_audio_noise_reduction, voice, turn_detection } = sessionUpdate, rest = __rest(sessionUpdate, ["type", "mcp_server_connections", "audio", "max_output_tokens", "input_audio_format", "output_audio_format", "input_audio_transcription", "input_audio_noise_reduction", "voice", "turn_detection"]);
    const sanitized = Object.assign({}, rest);
    const normalizedType = typeof sessionType === "string" && sessionType.trim()
        ? sessionType.trim()
        : undefined;
    if (normalizedType) {
        sanitized.type = normalizedType;
    }
    else if (!sanitized.type) {
        sanitized.type = "realtime";
    }
    if (sanitized.modalities !== undefined) {
        delete sanitized.modalities;
    }
    if (mcp_server_connections &&
        Array.isArray(mcp_server_connections) &&
        mcp_server_connections.length === 0) {
        delete sanitized.mcp_server_connections;
    }
    const audioInput = sanitizeAudioInputConfig({
        format: (_b = (_a = audio === null || audio === void 0 ? void 0 : audio.input) === null || _a === void 0 ? void 0 : _a.format) !== null && _b !== void 0 ? _b : input_audio_format,
        transcription: (_d = (_c = audio === null || audio === void 0 ? void 0 : audio.input) === null || _c === void 0 ? void 0 : _c.transcription) !== null && _d !== void 0 ? _d : input_audio_transcription,
        noiseReduction: (_f = (_e = audio === null || audio === void 0 ? void 0 : audio.input) === null || _e === void 0 ? void 0 : _e.noise_reduction) !== null && _f !== void 0 ? _f : input_audio_noise_reduction,
        turnDetection: (_h = (_g = audio === null || audio === void 0 ? void 0 : audio.input) === null || _g === void 0 ? void 0 : _g.turn_detection) !== null && _h !== void 0 ? _h : turn_detection,
    });
    const audioOutput = sanitizeAudioOutputConfig({
        format: (_k = (_j = audio === null || audio === void 0 ? void 0 : audio.output) === null || _j === void 0 ? void 0 : _j.format) !== null && _k !== void 0 ? _k : output_audio_format,
        voice: (_m = (_l = audio === null || audio === void 0 ? void 0 : audio.output) === null || _l === void 0 ? void 0 : _l.voice) !== null && _m !== void 0 ? _m : voice,
    });
    const sanitizedAudio = {};
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
function sanitizeAudioFormatConfig(value) {
    const normalizedType = normalizeAudioFormat(value);
    if (!normalizedType) {
        return undefined;
    }
    const sanitized = { type: normalizedType };
    return sanitized;
}
function sanitizeAudioInputConfig(params) {
    const { format, transcription, noiseReduction, turnDetection } = params;
    const sanitized = {};
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
        sanitized.turn_detection = (0, config_1.normalizeTurnDetectionConfig)(turnDetection);
    }
    return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}
function sanitizeAudioOutputConfig(params) {
    const { format, voice } = params;
    const sanitized = {};
    const sanitizedFormat = sanitizeAudioFormatConfig(format);
    if (sanitizedFormat) {
        sanitized.format = sanitizedFormat;
    }
    if (typeof voice === "string" && voice.trim()) {
        sanitized.voice = voice.trim();
    }
    return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}
function handleFrontendConnection(ws) {
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
function handleFunctionCall(item) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("Handling function call:", item);
        const fnDef = functionHandlers_1.default.find((f) => f.schema.name === item.name);
        if (!fnDef) {
            throw new Error(`No handler found for function: ${item.name}`);
        }
        let args;
        try {
            args = JSON.parse(item.arguments);
        }
        catch (_a) {
            return JSON.stringify({
                error: "Invalid JSON arguments for function call.",
            });
        }
        try {
            console.log("Calling function:", fnDef.schema.name, args);
            const result = yield fnDef.handler(args);
            return result;
        }
        catch (err) {
            console.error("Error running function:", err);
            return JSON.stringify({
                error: `Error running function ${item.name}: ${err.message}`,
            });
        }
    });
}
function handleTwilioMessage(data) {
    const msg = parseMessage(data);
    if (!msg)
        return;
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
function flushPendingAudio(options = {}) {
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
        }
        else {
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
function handleFrontendMessage(data) {
    const msg = parseMessage(data);
    if (!msg)
        return;
    if (msg.type === "session.update") {
        const sanitized = sanitizeSessionUpdatePayload(msg.session);
        session.saved_config = sanitized;
        if (isOpen(session.modelConn)) {
            const requestedModel = typeof sanitized.model === "string" ? sanitized.model : undefined;
            if (requestedModel && requestedModel !== session.activeModel) {
                console.info(`[Realtime] Model change requested (${session.activeModel || "(default)"} -> ${requestedModel}), restarting connection`);
                session.modelConn.close();
                return;
            }
            const { model: _ignoredModel } = sanitized, sessionWithoutModel = __rest(sanitized, ["model"]);
            sendOpenAIEvent(Object.assign(Object.assign({}, msg), { session: sessionWithoutModel }));
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
    if (isOpen(session.modelConn))
        return;
    if (session.reconnectTimer) {
        clearTimeout(session.reconnectTimer);
        session.reconnectTimer = undefined;
    }
    const overrides = session.saved_config || {};
    const requestedModel = typeof overrides.model === "string" && overrides.model.trim()
        ? overrides.model.trim()
        : config_1.REALTIME_MODEL;
    console.info(`[Realtime] Connecting to OpenAI model ${requestedModel} for stream ${session.streamSid}`);
    const headers = {
        Authorization: `Bearer ${session.openAIApiKey}`,
    };
    if (config_1.REALTIME_BETA_HEADER) {
        headers["OpenAI-Beta"] = config_1.REALTIME_BETA_HEADER;
    }
    session.modelConn = new ws_1.WebSocket(`wss://api.openai.com/v1/realtime?model=${encodeURIComponent(requestedModel)}`, "realtime", {
        headers,
    });
    session.modelConn.on("open", () => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u;
        console.info("[Realtime] Connected to OpenAI model websocket");
        session.activeModel = requestedModel;
        const overridesCurrent = session.saved_config || {};
        const defaults = (0, config_1.buildDefaultSessionConfig)();
        const overridesWithoutModel = Object.assign({}, overridesCurrent);
        delete overridesWithoutModel.model;
        delete overridesWithoutModel.modalities;
        const mergedAudio = {
            input: Object.assign(Object.assign(Object.assign({}, defaults.audio.input), (((_a = overridesCurrent.audio) === null || _a === void 0 ? void 0 : _a.input) || {})), { format: Object.assign(Object.assign({}, defaults.audio.input.format), (((_c = (_b = overridesCurrent.audio) === null || _b === void 0 ? void 0 : _b.input) === null || _c === void 0 ? void 0 : _c.format) || {})), transcription: (_f = (_e = (_d = overridesCurrent.audio) === null || _d === void 0 ? void 0 : _d.input) === null || _e === void 0 ? void 0 : _e.transcription) !== null && _f !== void 0 ? _f : defaults.audio.input.transcription, noise_reduction: (_j = (_h = (_g = overridesCurrent.audio) === null || _g === void 0 ? void 0 : _g.input) === null || _h === void 0 ? void 0 : _h.noise_reduction) !== null && _j !== void 0 ? _j : defaults.audio.input.noise_reduction, turn_detection: (0, config_1.normalizeTurnDetectionConfig)(((_l = (_k = overridesCurrent.audio) === null || _k === void 0 ? void 0 : _k.input) === null || _l === void 0 ? void 0 : _l.turn_detection) ||
                    defaults.audio.input.turn_detection) }),
            output: Object.assign(Object.assign(Object.assign({}, defaults.audio.output), (((_m = overridesCurrent.audio) === null || _m === void 0 ? void 0 : _m.output) || {})), { format: Object.assign(Object.assign({}, defaults.audio.output.format), (((_p = (_o = overridesCurrent.audio) === null || _o === void 0 ? void 0 : _o.output) === null || _p === void 0 ? void 0 : _p.format) || {})), voice: ((_r = (_q = overridesCurrent.audio) === null || _q === void 0 ? void 0 : _q.output) === null || _r === void 0 ? void 0 : _r.voice) || defaults.audio.output.voice }),
        };
        const sessionPayload = Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, defaults), overridesWithoutModel), { type: "realtime", model: requestedModel, instructions: overridesCurrent.instructions || defaults.instructions, tool_choice: overridesCurrent.tool_choice || defaults.tool_choice, tools: (_s = overridesCurrent.tools) !== null && _s !== void 0 ? _s : defaults.tools }), (((_t = overridesCurrent.mcp_server_connections) === null || _t === void 0 ? void 0 : _t.length)
            ? { mcp_server_connections: overridesCurrent.mcp_server_connections }
            : ((_u = defaults.mcp_server_connections) === null || _u === void 0 ? void 0 : _u.length)
                ? { mcp_server_connections: defaults.mcp_server_connections }
                : {})), { audio: mergedAudio });
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
        const reasonText = typeof reason === "string"
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
function handleModelMessage(data) {
    var _a;
    const event = parseMessage(data);
    if (!event)
        return;
    if (event.type === "error") {
        const errorCode = (_a = event.error) === null || _a === void 0 ? void 0 : _a.code;
        if (errorCode === "input_audio_buffer_commit_empty") {
            console.debug("[Realtime] OpenAI rejected empty audio commit; waiting for more audio");
            session.hasBufferedAudio = false;
            session.pendingAudioByteCount = 0;
            session.committedAudioPending = false;
        }
        else if (errorCode === "conversation_already_has_active_response") {
            session.responseInProgress = true;
            session.responseCreateQueued = true;
            console.debug("[Realtime] Response already in progress; queued follow-up response");
        }
        else {
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
                if (event.item_id)
                    session.lastAssistantItem = event.item_id;
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
                        const serializedOutput = typeof output === "string" ? output : JSON.stringify(output);
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
            if (!SUPPRESSED_MODEL_EVENTS.has(event.type) &&
                !DOCUMENTED_MODEL_EVENTS.has(event.type) &&
                !KNOWN_UNDOCUMENTED_MODEL_EVENTS.has(event.type)) {
                console.debug("[Realtime] Unhandled model event", event.type);
            }
            break;
    }
}
function handleTruncation() {
    if (!session.lastAssistantItem ||
        session.responseStartTimestamp === undefined)
        return;
    const elapsedMs = (session.latestMediaTimestamp || 0) - (session.responseStartTimestamp || 0);
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
    if (session.twilioConn && session.twilioConn.readyState === ws_1.WebSocket.OPEN) {
        session.reconnectTimer = setTimeout(() => {
            session.reconnectTimer = undefined;
            tryConnectModel();
        }, 200);
    }
    if (!session.twilioConn && !session.frontendConns)
        session = {};
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
function cleanupConnection(ws) {
    if (isOpen(ws))
        ws.close();
}
function parseMessage(data) {
    try {
        return JSON.parse(data.toString());
    }
    catch (_a) {
        return null;
    }
}
function jsonSend(ws, obj) {
    if (!isOpen(ws))
        return;
    ws.send(JSON.stringify(obj));
}
function broadcastToFrontends(obj) {
    if (!session.frontendConns || session.frontendConns.size === 0) {
        return;
    }
    for (const conn of session.frontendConns) {
        jsonSend(conn, obj);
    }
}
function requestResponseCreate(options = {}) {
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
function sendOpenAIEvent(event) {
    if (!event || typeof event !== "object") {
        console.warn("[Realtime] Ignoring malformed OpenAI event payload", event);
        return;
    }
    if (!("type" in event) || typeof event.type !== "string") {
        console.warn("[Realtime] Missing event.type field", event);
        return;
    }
    if (!(0, realtimeEvents_1.isRealtimeClientEventType)(event.type)) {
        console.warn("[Realtime] Unsupported OpenAI event type", event.type, event);
        return;
    }
    jsonSend(session.modelConn, event);
}
function isOpen(ws) {
    return !!ws && ws.readyState === ws_1.WebSocket.OPEN;
}
