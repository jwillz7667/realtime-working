# WebSocket Server (Backend)

This is the Express + WebSocket server that relays messages between Twilio phone calls and OpenAI's Realtime API.

## Local Development

```bash
npm install
npm run dev
```

Server will start on port 8081 (or `PORT` environment variable).

## Building for Production

```bash
npm run build   # Compiles TypeScript to dist/ and copies twiml.xml
npm start       # Runs the compiled server
```

## Environment Variables

Create a `.env` file (see `.env.example`):

```bash
# Required
OPENAI_API_KEY=sk-...
PUBLIC_URL=https://your-domain.com

# Optional (see .env.example for full list)
OPENAI_REALTIME_MODEL=gpt-realtime-2025-08-28
OPENAI_SESSION_INSTRUCTIONS="Your custom instructions"
# ... see .env.example for more
```

## Deployment to Railway

See [../DEPLOYMENT.md](../DEPLOYMENT.md) for complete Railway deployment instructions.

Quick steps:
1. Push code to GitHub
2. Create new Railway project from repo
3. Set root directory to `websocket-server`
4. Add environment variables (`OPENAI_API_KEY`, `PUBLIC_URL`)
5. Railway will auto-deploy using `nixpacks.toml`

## Endpoints

- `GET /public-url` - Returns the configured PUBLIC_URL
- `GET /twiml` - Returns TwiML for Twilio to start streaming
- `GET /tools` - Returns available function schemas
- `WS /call` - WebSocket endpoint for Twilio phone streams
- `WS /logs` - WebSocket endpoint for frontend event subscriptions

## File Structure

- `src/server.ts` - Main Express server and WebSocket setup
- `src/sessionManager.ts` - Core relay logic and session state
- `src/config.ts` - Environment variable parsing and defaults
- `src/realtimeEvents.ts` - OpenAI Realtime API event types
- `src/functionHandlers.ts` - Function call handlers
- `src/types.ts` - Shared TypeScript types
- `src/twiml.xml` - TwiML template for Twilio
- `nixpacks.toml` - Railway deployment configuration
