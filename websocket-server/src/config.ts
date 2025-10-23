import dotenv from "dotenv";

dotenv.config();

type SemanticEagerness = "auto" | "low" | "medium" | "high";

function parseSemanticEagerness(value: string | undefined): SemanticEagerness {
  if (!value) return "auto";
  const normalized = value.trim().toLowerCase();
  if (normalized === "low" || normalized === "medium" || normalized === "high") {
    return normalized;
  }
  if (normalized === "auto") return "auto";
  console.warn(
    `Unknown OPENAI_TURN_DETECTION_EAGERNESS value: ${value}. Expected auto, low, medium, or high.`
  );
  return "auto";
}

const DEFAULT_SEMANTIC_EAGERNESS = parseSemanticEagerness(
  process.env.OPENAI_TURN_DETECTION_EAGERNESS
);

const DEFAULT_TURN_DETECTION = {
  type: "semantic_vad",
  eagerness: DEFAULT_SEMANTIC_EAGERNESS,
  interrupt_response: true,
  create_response: true,
};

const DEFAULT_AUDIO_INPUT_RATE = 8000;
const DEFAULT_AUDIO_OUTPUT_RATE = 8000;

export function normalizeModalities(value: unknown): string[] {
  if (!value) return [];

  if (!Array.isArray(value)) {
    if (typeof value === "string") {
      return normalizeModalities([value]);
    }
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function parseJson<T>(value: string | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch (err) {
    console.warn("Failed to parse JSON env", err);
    return fallback;
  }
}

function parseJsonArray(value: string | undefined): any[] {
  const parsed = parseJson<any[]>(value, []);
  return Array.isArray(parsed) ? parsed : [];
}

function parseRate(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseOptionalJson(value: string | undefined) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (err) {
    console.warn("Failed to parse optional JSON env", err);
    return null;
  }
}

function parseNoiseReduction(value: string | undefined) {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized === "none" || normalized === "null") {
    return null;
  }

  if (normalized === "near_field" || normalized === "far_field") {
    return { type: normalized };
  }

  console.warn(
    `Unrecognized OPENAI_AUDIO_INPUT_NOISE_REDUCTION value: ${value}. Expected near_field, far_field, or none.`
  );
  return null;
}

export function normalizeTurnDetectionConfig(value: any) {
  if (!value || typeof value !== "object") return value;
  if (value.type === "semantic_vad") {
    const eagerness = parseSemanticEagerness(value.eagerness);
    return {
      ...value,
      eagerness,
      create_response:
        value.create_response !== undefined
          ? Boolean(value.create_response)
          : true,
      interrupt_response:
        value.interrupt_response !== undefined
          ? Boolean(value.interrupt_response)
          : true,
    };
  }
  return value;
}

export const REALTIME_MODEL =
  process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-2025-08-28";

export const DEFAULT_INSTRUCTIONS =
  process.env.OPENAI_SESSION_INSTRUCTIONS ||
  "You are a helpful realtime assistant that speaks clearly, listens carefully, and reacts quickly.";

export const DEFAULT_VOICE = process.env.OPENAI_DEFAULT_VOICE || "marin";

export const DEFAULT_TURN_DETECTION_CONFIG = normalizeTurnDetectionConfig(
  parseJson(process.env.OPENAI_TURN_DETECTION_JSON, DEFAULT_TURN_DETECTION)
);

export const DEFAULT_TOOL_CHOICE =
  process.env.OPENAI_TOOL_CHOICE || "auto";

export const DEFAULT_TOOLS = parseJsonArray(
  process.env.OPENAI_DEFAULT_TOOLS_JSON
);

export const DEFAULT_MCP_SERVERS = parseJsonArray(
  process.env.OPENAI_DEFAULT_MCP_JSON
);

export const AUDIO_INPUT_FORMAT = {
  type: process.env.OPENAI_AUDIO_INPUT_FORMAT_TYPE || "audio/pcmu",
  rate: parseRate(
    process.env.OPENAI_AUDIO_INPUT_SAMPLE_RATE,
    DEFAULT_AUDIO_INPUT_RATE
  ),
};

export const AUDIO_OUTPUT_FORMAT = {
  type: process.env.OPENAI_AUDIO_OUTPUT_FORMAT_TYPE || "audio/pcmu",
  rate: parseRate(
    process.env.OPENAI_AUDIO_OUTPUT_SAMPLE_RATE,
    DEFAULT_AUDIO_OUTPUT_RATE
  ),
};

export const AUDIO_INPUT_TRANSCRIPTION =
  parseOptionalJson(process.env.OPENAI_AUDIO_INPUT_TRANSCRIPTION_JSON) ||
  (process.env.OPENAI_TRANSCRIPTION_MODEL
    ? { model: process.env.OPENAI_TRANSCRIPTION_MODEL }
    : null);

export const AUDIO_INPUT_NOISE_REDUCTION = parseNoiseReduction(
  process.env.OPENAI_AUDIO_INPUT_NOISE_REDUCTION
);

const betaHeader = process.env.OPENAI_REALTIME_BETA;
const normalizedBetaHeader = betaHeader ? betaHeader.trim() : "";
export const REALTIME_BETA_HEADER =
  normalizedBetaHeader && normalizedBetaHeader.toLowerCase() !== "none"
    ? normalizedBetaHeader
    : "";

export function buildDefaultSessionConfig() {
  const normalizedDefaultTurnDetection = normalizeTurnDetectionConfig(
    DEFAULT_TURN_DETECTION_CONFIG
  );
  const mcpConnections = DEFAULT_MCP_SERVERS.length
    ? DEFAULT_MCP_SERVERS
    : undefined;

  return {
    type: "realtime" as const,
    model: REALTIME_MODEL,
    instructions: DEFAULT_INSTRUCTIONS,
    tool_choice: DEFAULT_TOOL_CHOICE,
    tools: DEFAULT_TOOLS,
    ...(mcpConnections
      ? { mcp_server_connections: mcpConnections }
      : {}),
    audio: {
      input: {
        format: AUDIO_INPUT_FORMAT,
        transcription: AUDIO_INPUT_TRANSCRIPTION,
        noise_reduction: AUDIO_INPUT_NOISE_REDUCTION,
        turn_detection: normalizedDefaultTurnDetection,
      },
      output: {
        format: AUDIO_OUTPUT_FORMAT,
        voice: DEFAULT_VOICE,
      },
    },
  };
}
