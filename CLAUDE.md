# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an OpenAI Realtime API + Twilio voice calling integration demo. The architecture consists of two main components:

1. **webapp** (Next.js frontend) - Configuration UI, call controls, and real-time transcripts
2. **websocket-server** (Express backend) - WebSocket relay that bridges Twilio phone streams with OpenAI's Realtime API

The websocket server acts as a bidirectional relay:
- Twilio phone calls → OpenAI Realtime API (voice input)
- OpenAI Realtime API → Twilio (voice output)
- OpenAI Realtime API → webapp frontend (event logs, transcripts)

## Common Development Commands

### WebApp (Next.js Frontend)

```bash
cd webapp
npm install
npm run dev      # Start dev server (http://localhost:3000)
npm run build    # Production build
npm run lint     # Lint code
```

### WebSocket Server (Express Backend)

```bash
cd websocket-server
npm install
npm run dev      # Start with hot-reload using nodemon
npm run build    # Compile TypeScript to dist/
npm start        # Run compiled version from dist/
```

### Ngrok (For Local Development)

```bash
# With static domain (recommended if available)
ngrok http 8081 --domain=your-static-domain.ngrok.pro

# Or with free dynamic domain
ngrok http 8081
```

The ngrok forwarding URL must be set as `PUBLIC_URL` in `websocket-server/.env`.

**Note:** Static ngrok domains (e.g., `realtime.ngrok.pro`) don't change between restarts, making them ideal for development since you don't need to update Twilio webhooks or environment variables.

## Deployment

Multiple deployment options available:

### Option 1: Local Backend + Static Ngrok (Recommended for Development)
- Backend runs locally, exposed via static ngrok domain (e.g., `https://realtime.ngrok.pro`)
- Frontend deployed to Vercel
- **Pros:** Free backend, easy debugging, fast iteration
- **Cons:** Backend must be running locally
- See [DEPLOYMENT_OPTIONS.md](DEPLOYMENT_OPTIONS.md) for setup

### Option 2: Railway Backend + Vercel Frontend (Recommended for Production)
- Both backend and frontend fully cloud-hosted
- **Pros:** 24/7 availability, auto-restart, no local dependencies
- **Cons:** ~$5-15/month for Railway
- See [DEPLOYMENT.md](DEPLOYMENT.md) for setup

### Option 3: Hybrid (Development + Production)
- Use static ngrok during development
- Switch to Railway for production/demos
- See [DEPLOYMENT_OPTIONS.md](DEPLOYMENT_OPTIONS.md) for switching workflow

Quick deployment checklist (Railway + Vercel):
1. Deploy websocket-server to Railway with `OPENAI_API_KEY` and `PUBLIC_URL`
2. Deploy webapp to Vercel with `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `NEXT_PUBLIC_REALTIME_SERVER_URL`
3. Configure Twilio phone number webhook to point to backend `/twiml` endpoint (Railway or ngrok)

## Environment Configuration

### websocket-server/.env

Required:
- `OPENAI_API_KEY` - OpenAI API key for Realtime API access
- `PUBLIC_URL` - Externally reachable base URL (your ngrok https endpoint)

Optional (with defaults shown in `.env.example`):
- `OPENAI_REALTIME_MODEL` - Model to use (default: `gpt-realtime-2025-08-28`)
- `OPENAI_SESSION_INSTRUCTIONS` - System prompt for the assistant
- `OPENAI_DEFAULT_VOICE` - Voice to use (e.g., `marin`)
- `OPENAI_AUDIO_INPUT_FORMAT_TYPE` / `OPENAI_AUDIO_OUTPUT_FORMAT_TYPE` - Audio codec (default: `g711_ulaw` for Twilio)
- `OPENAI_AUDIO_INPUT_SAMPLE_RATE` / `OPENAI_AUDIO_OUTPUT_SAMPLE_RATE` - Audio rate (default: `8000` Hz)
- `OPENAI_AUDIO_INPUT_NOISE_REDUCTION` - Noise reduction mode (`near_field` or `far_field`)
- `OPENAI_TURN_DETECTION_JSON` - Semantic VAD configuration for turn detection
- `OPENAI_TOOL_CHOICE` - Tool selection policy (default: `auto`)
- `OPENAI_DEFAULT_TOOLS_JSON` - JSON array of tool schemas
- `OPENAI_DEFAULT_MCP_JSON` - JSON array of MCP server connections
- `OPENAI_TRANSCRIPTION_MODEL` - Transcription model (default: `whisper-1`)

### webapp/.env

Required:
- `TWILIO_ACCOUNT_SID` - Twilio account SID (starts with AC...)
- `TWILIO_AUTH_TOKEN` - Twilio auth token

Optional:
- `TWILIO_OUTBOUND_NUMBER` - Default caller ID for outgoing calls (E.164 format)
- `TWILIO_TWIML_URL` - Explicit TwiML URL (defaults to websocket-server PUBLIC_URL)
- `NEXT_PUBLIC_REALTIME_SERVER_URL` - Override relay base URL (defaults to `http://localhost:8081`)

## Architecture Details

### Call Flow Lifecycle

1. **Setup Phase:**
   - Run ngrok to expose local server to internet
   - Configure Twilio webhook to point to ngrok address
   - Frontend connects to backend via WebSocket (`wss://[backend]/logs`)

2. **Call Phase:**
   - Call placed to Twilio-managed number
   - Twilio queries webhook (`/twiml`) for TwiML instructions
   - TwiML response tells Twilio to open bidirectional stream to `/call` endpoint
   - Backend establishes WebSocket connection to OpenAI Realtime API
   - Backend relays messages between:
     - Twilio ↔ OpenAI (audio stream)
     - OpenAI ↔ Frontend (events, transcripts)

### WebSocket Connections

The websocket-server handles three concurrent WebSocket connections:

1. **Twilio Connection (`/call`)** - Receives µ-law encoded audio at 8kHz from phone call
2. **OpenAI Connection** - Connects to `wss://api.openai.com/v1/realtime?model=...`
3. **Frontend Connection (`/logs`)** - Broadcasts OpenAI events to UI for display

### Session Management (websocket-server/src/sessionManager.ts)

Core session state includes:
- `twilioConn` - WebSocket to Twilio phone stream
- `modelConn` - WebSocket to OpenAI Realtime API
- `frontendConns` - Set of WebSocket connections to frontend clients
- `streamSid` / `callSid` - Twilio identifiers
- `saved_config` - Session overrides sent from frontend
- Audio buffering state (`hasBufferedAudio`, `pendingAudioByteCount`, `pendingCommitTimer`)
- Response state (`responseInProgress`, `responseCreateQueued`)

**Audio Buffering Strategy:**
- Audio chunks from Twilio are accumulated in OpenAI's input buffer
- A commit is triggered after `PENDING_COMMIT_DELAY_MS` (120ms) or when `MIN_COMMIT_BYTES` are buffered
- This ensures audio chunks are large enough for meaningful processing

**Model Reconnection:**
- If the OpenAI WebSocket closes and Twilio is still connected, the server automatically attempts reconnection after 200ms
- Model changes from the frontend trigger a reconnection with new model parameters

### Audio Format Handling

Twilio streams audio as:
- Format: µ-law (G.711 PCMU)
- Sample rate: 8 kHz
- Encoding: base64 in WebSocket messages

The server normalizes audio format aliases in `sessionManager.ts`:
- `g711_ulaw`, `audio/pcmu`, `pcmu`, `mulaw` → `audio/pcmu`
- `g711_alaw`, `audio/pcma`, `pcma`, `alaw` → `audio/pcma`
- `pcm16`, `linear16`, `audio/pcm` → `audio/pcm`

### Configuration Merging

Session configuration follows this precedence:
1. Frontend UI overrides (from session configuration panel)
2. Environment variables in `websocket-server/.env`
3. Hardcoded defaults in `config.ts`

The `sanitizeSessionUpdatePayload` function in `sessionManager.ts` normalizes session updates to match OpenAI's schema, handling field name migrations (e.g., `max_output_tokens` → `max_response_output_tokens`).

### Function Calling

Function calls are handled in `sessionManager.ts`:
- When OpenAI emits `response.output_item.done` with `type: "function_call"`, the handler looks up the function in `functionHandlers.ts`
- Function result is returned as a `conversation.item.create` event with `type: "function_call_output"`
- A forced `response.create` is triggered to generate assistant response

Function schemas are exposed via the `/tools` HTTP endpoint for the frontend to display and configure.

### Turn Detection & Interruption

The default configuration uses `semantic_vad` with:
- Eagerness levels: `auto`, `low`, `medium`, `high`
- `interrupt_response: true` - Allows user to interrupt assistant
- `create_response: true` - Automatically generates responses after user turns

Interruptions are handled via `handleTruncation()`:
- When `input_audio_buffer.speech_started` event occurs during assistant speech
- Calculates `audio_end_ms` based on elapsed time since response start
- Sends `conversation.item.truncate` to OpenAI
- Sends `clear` event to Twilio to flush playback buffer

### Frontend Architecture (webapp)

**Main Components:**
- `app/page.tsx` - Entry point, renders `CallInterface`
- `components/call-interface.tsx` - Main UI orchestrator
- `components/checklist-and-config.tsx` - Setup checklist and session configuration
- `components/session-configuration-panel.tsx` - Real-time session settings
- `components/transcript.tsx` - Displays conversation transcript
- `components/function-calls-panel.tsx` - Shows function call details
- `components/tool-configuration-dialog.tsx` - Tool/MCP server configuration UI

**API Routes:**
- `app/api/twilio/route.ts` - Initiates outgoing calls, handles call recording
- `app/api/twilio/webhook-local/route.ts` - Local webhook testing endpoint

**WebSocket Communication:**
- Frontend connects to `ws://localhost:8081/logs` (or `NEXT_PUBLIC_REALTIME_SERVER_URL`)
- Receives real-time events from OpenAI via the relay
- Sends `session.update` to modify session configuration
- Can send any valid Realtime API client event to control the session

### Outgoing Calls

The webapp can initiate outgoing calls via the Twilio REST API:
- Enter destination number in E.164 format (e.g., `+15551234567`)
- Uses `TWILIO_OUTBOUND_NUMBER` as caller ID
- TwiML template is served from websocket-server's `/twiml` endpoint
- Same streaming mechanism as inbound calls

### Call Recording

The checklist panel exposes recording controls:
- **Start Recording** - Calls Twilio's Voice Recording API with `callSid`
- **Stop Recording** - Stops active recording
- Recordings default to dual-channel µ-law audio
- Recording SID is surfaced in the UI once captured

## Key Files

### Backend (websocket-server/src/)
- `server.ts` - HTTP server, WebSocket server, TwiML endpoint, `/tools` endpoint
- `sessionManager.ts` - Core relay logic, session state, audio buffering, interruption handling
- `config.ts` - Environment variable parsing, default session config builder
- `realtimeEvents.ts` - Type definitions for OpenAI Realtime API events
- `functionHandlers.ts` - Function call definitions and handlers
- `types.ts` - Shared TypeScript types
- `twiml.xml` - TwiML template for Twilio streaming

### Frontend (webapp/)
- `app/page.tsx` - Next.js page entry point
- `app/layout.tsx` - Root layout with metadata
- `components/call-interface.tsx` - Main call UI component
- `components/session-configuration-panel.tsx` - Session config controls
- `components/transcript.tsx` - Conversation transcript display
- `lib/twilio.ts` - Twilio client utilities
- `lib/use-backend-tools.ts` - Hook for fetching backend tool schemas
- `lib/tool-templates.ts` - Predefined tool templates
- `lib/mcp-templates.ts` - MCP server templates

## Development Tips

- **Ports:** webapp runs on 3000, websocket-server runs on 8081 by default
- **Hot Reload:** Both projects support hot reload during development
- **Debugging:** OpenAI events are logged to websocket-server console with `[Realtime]` prefix
- **Event Suppression:** High-frequency events like `response.audio.delta` are not logged to avoid console spam (see `SUPPRESSED_MODEL_EVENTS` in `sessionManager.ts`)
- **Schema Compliance:** The server aligns with OpenAI's Realtime GA schema (as of 2025-08-28), handling field migrations automatically
- **MCP Servers:** Model Context Protocol servers can be configured via environment variables or the UI

## Security Considerations

This is a demo repository with intentionally relaxed security:
- API keys are handled via environment variables
- No authentication on WebSocket endpoints
- Frontend can send arbitrary events to OpenAI via the relay
- Not intended for production deployment without security hardening

## Testing

No automated tests are currently defined. To test manually:

1. Verify setup checklist in webapp turns green
2. Place inbound call to Twilio number
3. Monitor websocket-server console for connection events
4. Verify transcript appears in real-time in webapp
5. Test interruption by speaking while assistant is talking
6. Test function calling by triggering tool usage in conversation
7. Test outgoing calls from webapp UI
8. Test call recording controls
