"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.REALTIME_BETA_HEADER = exports.AUDIO_INPUT_NOISE_REDUCTION = exports.AUDIO_INPUT_TRANSCRIPTION = exports.AUDIO_OUTPUT_FORMAT = exports.AUDIO_INPUT_FORMAT = exports.DEFAULT_MCP_SERVERS = exports.DEFAULT_TOOLS = exports.DEFAULT_TOOL_CHOICE = exports.DEFAULT_TURN_DETECTION_CONFIG = exports.DEFAULT_VOICE = exports.DEFAULT_INSTRUCTIONS = exports.REALTIME_MODEL = void 0;
exports.normalizeModalities = normalizeModalities;
exports.normalizeTurnDetectionConfig = normalizeTurnDetectionConfig;
exports.buildDefaultSessionConfig = buildDefaultSessionConfig;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
function parseSemanticEagerness(value) {
    if (!value)
        return "auto";
    const normalized = value.trim().toLowerCase();
    if (normalized === "low" || normalized === "medium" || normalized === "high") {
        return normalized;
    }
    if (normalized === "auto")
        return "auto";
    console.warn(`Unknown OPENAI_TURN_DETECTION_EAGERNESS value: ${value}. Expected auto, low, medium, or high.`);
    return "auto";
}
const DEFAULT_SEMANTIC_EAGERNESS = parseSemanticEagerness(process.env.OPENAI_TURN_DETECTION_EAGERNESS);
const DEFAULT_TURN_DETECTION = {
    type: "semantic_vad",
    eagerness: DEFAULT_SEMANTIC_EAGERNESS,
    interrupt_response: true,
    create_response: true,
};
const DEFAULT_AUDIO_INPUT_RATE = 8000;
const DEFAULT_AUDIO_OUTPUT_RATE = 8000;
function normalizeModalities(value) {
    if (!value)
        return [];
    if (!Array.isArray(value)) {
        if (typeof value === "string") {
            return normalizeModalities([value]);
        }
        return [];
    }
    return value
        .filter((entry) => typeof entry === "string")
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean);
}
function parseJson(value, fallback) {
    if (!value)
        return fallback;
    try {
        return JSON.parse(value);
    }
    catch (err) {
        console.warn("Failed to parse JSON env", err);
        return fallback;
    }
}
function parseJsonArray(value) {
    const parsed = parseJson(value, []);
    return Array.isArray(parsed) ? parsed : [];
}
function parseRate(value, fallback) {
    if (!value)
        return fallback;
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
function parseOptionalJson(value) {
    if (!value)
        return null;
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === "object" ? parsed : null;
    }
    catch (err) {
        console.warn("Failed to parse optional JSON env", err);
        return null;
    }
}
function parseNoiseReduction(value) {
    if (!value)
        return null;
    const normalized = value.trim().toLowerCase();
    if (!normalized || normalized === "none" || normalized === "null") {
        return null;
    }
    if (normalized === "near_field" || normalized === "far_field") {
        return { type: normalized };
    }
    console.warn(`Unrecognized OPENAI_AUDIO_INPUT_NOISE_REDUCTION value: ${value}. Expected near_field, far_field, or none.`);
    return null;
}
function normalizeTurnDetectionConfig(value) {
    if (!value || typeof value !== "object")
        return value;
    if (value.type === "semantic_vad") {
        const eagerness = parseSemanticEagerness(value.eagerness);
        return Object.assign(Object.assign({}, value), { eagerness, create_response: value.create_response !== undefined
                ? Boolean(value.create_response)
                : true, interrupt_response: value.interrupt_response !== undefined
                ? Boolean(value.interrupt_response)
                : true });
    }
    return value;
}
exports.REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-2025-08-28";
exports.DEFAULT_INSTRUCTIONS = process.env.OPENAI_SESSION_INSTRUCTIONS ||
    "You are a helpful realtime assistant that speaks clearly, listens carefully, and reacts quickly.";
exports.DEFAULT_VOICE = process.env.OPENAI_DEFAULT_VOICE || "marin";
exports.DEFAULT_TURN_DETECTION_CONFIG = normalizeTurnDetectionConfig(parseJson(process.env.OPENAI_TURN_DETECTION_JSON, DEFAULT_TURN_DETECTION));
exports.DEFAULT_TOOL_CHOICE = process.env.OPENAI_TOOL_CHOICE || "auto";
exports.DEFAULT_TOOLS = parseJsonArray(process.env.OPENAI_DEFAULT_TOOLS_JSON);
exports.DEFAULT_MCP_SERVERS = parseJsonArray(process.env.OPENAI_DEFAULT_MCP_JSON);
exports.AUDIO_INPUT_FORMAT = {
    type: process.env.OPENAI_AUDIO_INPUT_FORMAT_TYPE || "audio/pcmu",
    rate: parseRate(process.env.OPENAI_AUDIO_INPUT_SAMPLE_RATE, DEFAULT_AUDIO_INPUT_RATE),
};
exports.AUDIO_OUTPUT_FORMAT = {
    type: process.env.OPENAI_AUDIO_OUTPUT_FORMAT_TYPE || "audio/pcmu",
    rate: parseRate(process.env.OPENAI_AUDIO_OUTPUT_SAMPLE_RATE, DEFAULT_AUDIO_OUTPUT_RATE),
};
exports.AUDIO_INPUT_TRANSCRIPTION = parseOptionalJson(process.env.OPENAI_AUDIO_INPUT_TRANSCRIPTION_JSON) ||
    (process.env.OPENAI_TRANSCRIPTION_MODEL
        ? { model: process.env.OPENAI_TRANSCRIPTION_MODEL }
        : null);
exports.AUDIO_INPUT_NOISE_REDUCTION = parseNoiseReduction(process.env.OPENAI_AUDIO_INPUT_NOISE_REDUCTION);
const betaHeader = process.env.OPENAI_REALTIME_BETA;
const normalizedBetaHeader = betaHeader ? betaHeader.trim() : "";
exports.REALTIME_BETA_HEADER = normalizedBetaHeader && normalizedBetaHeader.toLowerCase() !== "none"
    ? normalizedBetaHeader
    : "";
function buildDefaultSessionConfig() {
    const normalizedDefaultTurnDetection = normalizeTurnDetectionConfig(exports.DEFAULT_TURN_DETECTION_CONFIG);
    const mcpConnections = exports.DEFAULT_MCP_SERVERS.length
        ? exports.DEFAULT_MCP_SERVERS
        : undefined;
    return Object.assign(Object.assign({ type: "realtime", model: exports.REALTIME_MODEL, instructions: exports.DEFAULT_INSTRUCTIONS, tool_choice: exports.DEFAULT_TOOL_CHOICE, tools: exports.DEFAULT_TOOLS }, (mcpConnections
        ? { mcp_server_connections: mcpConnections }
        : {})), { audio: {
            input: {
                format: exports.AUDIO_INPUT_FORMAT,
                transcription: exports.AUDIO_INPUT_TRANSCRIPTION,
                noise_reduction: exports.AUDIO_INPUT_NOISE_REDUCTION,
                turn_detection: normalizedDefaultTurnDetection,
            },
            output: {
                format: exports.AUDIO_OUTPUT_FORMAT,
                voice: exports.DEFAULT_VOICE,
            },
        } });
}
