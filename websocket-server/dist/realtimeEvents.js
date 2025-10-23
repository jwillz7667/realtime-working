"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REALTIME_SERVER_EVENT_TYPES = exports.REALTIME_CLIENT_EVENT_TYPES = void 0;
exports.isRealtimeClientEventType = isRealtimeClientEventType;
exports.isRealtimeServerEventType = isRealtimeServerEventType;
exports.isRealtimeEventType = isRealtimeEventType;
// Canonical list of Realtime event type strings mirrored from
// docs/OpenAI-Realtime-API-Events.md. Keep this list in sync with the docs.
exports.REALTIME_CLIENT_EVENT_TYPES = [
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
];
exports.REALTIME_SERVER_EVENT_TYPES = [
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
    "response.output_item.added",
    "response.output_item.done",
];
const CLIENT_EVENT_TYPE_SET = new Set(exports.REALTIME_CLIENT_EVENT_TYPES);
const SERVER_EVENT_TYPE_SET = new Set(exports.REALTIME_SERVER_EVENT_TYPES);
const ALL_REALTIME_EVENT_TYPE_SET = new Set([
    ...exports.REALTIME_CLIENT_EVENT_TYPES,
    ...exports.REALTIME_SERVER_EVENT_TYPES,
]);
function isRealtimeClientEventType(value) {
    return CLIENT_EVENT_TYPE_SET.has(value);
}
function isRealtimeServerEventType(value) {
    return SERVER_EVENT_TYPE_SET.has(value);
}
function isRealtimeEventType(value) {
    return ALL_REALTIME_EVENT_TYPE_SET.has(value);
}
