# WebApp (Frontend)

Next.js application for configuring Realtime API sessions, placing calls, and viewing real-time transcripts.

## Local Development

```bash
npm install
npm run dev
```

App will be available at http://localhost:3000

## Building for Production

```bash
npm run build
npm start
```

## Environment Variables

Create a `.env.local` file (see `.env.example`):

```bash
# Required
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...

# Optional
TWILIO_OUTBOUND_NUMBER=+15551234567
NEXT_PUBLIC_REALTIME_SERVER_URL=https://your-backend.railway.app
```

## Deployment to Vercel

See [../DEPLOYMENT.md](../DEPLOYMENT.md) for complete Vercel deployment instructions.

Quick steps:
1. Push code to GitHub
2. Create new Vercel project from repo
3. Set root directory to `webapp`
4. Add environment variables
5. Deploy

## Features

- **Session Configuration** - Configure OpenAI Realtime API session parameters
- **Call Controls** - Place outbound calls, start/stop recording
- **Real-time Transcripts** - View conversation transcripts as they happen
- **Function Calling** - Configure and test function/tool calls
- **MCP Servers** - Configure Model Context Protocol server connections
- **Setup Checklist** - Verify all connections are working

## API Routes

- `POST /api/twilio/route` - Initiate outbound calls, control call recording
- `POST /api/twilio/webhook-local` - Local webhook testing endpoint

## Components

- `components/call-interface.tsx` - Main UI container
- `components/session-configuration-panel.tsx` - Session settings
- `components/transcript.tsx` - Conversation display
- `components/checklist-and-config.tsx` - Setup verification
- `components/function-calls-panel.tsx` - Function call viewer
- `components/tool-configuration-dialog.tsx` - Tool/MCP configuration
