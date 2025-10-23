// Canonical list of Realtime event type strings mirrored from
// docs/OpenAI-Realtime-API-Events.md. Keep this list in sync with the docs.
export const REALTIME_CLIENT_EVENT_TYPES = [
  "session.update",
  "input_audio_buffer.append",
  "input_audio_buffer.commit",
  "input_audio_buffer.clear",
  "conversation.item.create",
  "conversation.item.retrieve",
  "conversation.item.truncate",
  "conversation.item.delete",
  "response.create",
  "response.cancel",
  "output_audio_buffer.clear",
] as const;

export const REALTIME_SERVER_EVENT_TYPES = [
  "error",
  "session.created",
  "session.updated",
  "conversation.item.added",
  "conversation.item.done",
  "conversation.item.retrieved",
  "conversation.item.truncated",
  "conversation.item.deleted",
  "conversation.item.input_audio_transcription.completed",
  "conversation.item.input_audio_transcription.delta",
  "conversation.item.input_audio_transcription.segment",
  "conversation.item.input_audio_transcription.failed",
  "input_audio_buffer.committed",
  "input_audio_buffer.cleared",
  "input_audio_buffer.speech_started",
  "input_audio_buffer.speech_stopped",
  "input_audio_buffer.timeout_triggered",
  "output_audio_buffer.started",
  "output_audio_buffer.stopped",
  "output_audio_buffer.cleared",
  "response.created",
  "response.done",
  "response.output_text.delta",
  "response.output_text.done",
  "response.output_audio.delta",
  "response.output_audio.done",
  "response.output_audio_transcript.delta",
  "response.output_audio_transcript.done",
  "response.content_part.added",
  "response.content_part.done",
  "response.output_item.added",
  "response.output_item.done",
] as const;

export type RealtimeClientEventType =
  (typeof REALTIME_CLIENT_EVENT_TYPES)[number];
export type RealtimeServerEventType =
  (typeof REALTIME_SERVER_EVENT_TYPES)[number];
export type RealtimeEventType =
  RealtimeClientEventType | RealtimeServerEventType;

const CLIENT_EVENT_TYPE_SET = new Set<string>(REALTIME_CLIENT_EVENT_TYPES);
const SERVER_EVENT_TYPE_SET = new Set<string>(REALTIME_SERVER_EVENT_TYPES);
const ALL_REALTIME_EVENT_TYPE_SET = new Set<string>([
  ...REALTIME_CLIENT_EVENT_TYPES,
  ...REALTIME_SERVER_EVENT_TYPES,
]);

export function isRealtimeClientEventType(
  value: string,
): value is RealtimeClientEventType {
  return CLIENT_EVENT_TYPE_SET.has(value);
}

export function isRealtimeServerEventType(
  value: string,
): value is RealtimeServerEventType {
  return SERVER_EVENT_TYPE_SET.has(value);
}

export function isRealtimeEventType(value: string): value is RealtimeEventType {
  return ALL_REALTIME_EVENT_TYPE_SET.has(value);
}
