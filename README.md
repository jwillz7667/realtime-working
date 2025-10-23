# OpenAI Realtime API with Twilio Quickstart

Combine OpenAI's Realtime API and Twilio's phone calling capability to build an AI calling assistant.

<img width="1728" alt="Screenshot 2024-12-18 at 4 59 30 PM" src="https://github.com/user-attachments/assets/d3c8dcce-b339-410c-85ca-864a8e0fc326" />

## Quick Setup

Open three terminal windows:

| Terminal | Purpose                       | Quick Reference (see below for more) |
| -------- | ----------------------------- | ------------------------------------ |
| 1        | To run the `webapp`           | `npm run dev`                        |
| 2        | To run the `websocket-server` | `npm run dev`                        |
| 3        | To run `ngrok`                | `ngrok http 8081`                    |

Make sure all vars in `webapp/.env` and `websocket-server/.env` are set correctly. See [full setup](#full-setup) section for more.

## Overview

This repo implements a phone calling assistant with the Realtime API and Twilio, and had two main parts: the `webapp`, and the `websocket-server`.

1. `webapp`: NextJS app to serve as a frontend for call configuration and transcripts
2. `websocket-server`: Express backend that handles connection from Twilio, connects it to the Realtime API, and forwards messages to the frontend
<img width="1514" alt="Screenshot 2024-12-20 at 10 32 40 AM" src="https://github.com/user-attachments/assets/61d39b88-4861-4b6f-bfe2-796957ab5476" />

Twilio uses TwiML (a form of XML) to specify how to handle a phone call. When a call comes in we tell Twilio to start a bi-directional stream to our backend, where we forward messages between the call and the Realtime API. (`{{WS_URL}}` is replaced with our websocket endpoint.)

```xml
<!-- TwiML to start a bi-directional stream-->

<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Connected</Say>
  <Connect>
    <Stream url="{{WS_URL}}" />
  </Connect>
  <Say>Disconnected</Say>
</Response>
```

We use `ngrok` to make our server reachable by Twilio.

## Outgoing Calls

With your environment variables set (`TWILIO_OUTBOUND_NUMBER` for a default caller ID and `PUBLIC_URL` for the websocket server), you can place calls directly from the webapp. Once the setup checklist is green, enter a destination number (E.164 format) in the "Dial Number" box and press **Start Outgoing Call**. The Next.js API will create a Twilio call that streams audio through the realtime server using the same TwiML template.

### Call Recording

After a call is active, the checklist panel exposes **Start** and **Stop** buttons that call Twilio's Voice Recording API for the live `callSid`. Recordings default to dual-channel µ-law audio and appear in the Twilio Console; the UI surfaces the recording SID once captured. Recording commands require the same `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN` configured in `webapp/.env`.

## Realtime Session Defaults

The session configuration panel speaks the latest Realtime GA schema:

- **Model** defaults to `gpt-realtime`, but you can target a dated release (e.g. `gpt-realtime-2025-08-28`).
- **Audio pipeline** is tuned for Twilio: input/output media `g711_ulaw` (PCMU @ 8 kHz), near-field noise reduction, and `semantic_vad` with eagerness controls. Adjust these values or disable noise reduction as needed.
- **Transcription** runs on `whisper-1` by default; clear the model field to turn it off or swap to `gpt-4o-transcribe` for low-latency captions.
- **Tools & MCP servers** can be added from local templates, backend-advertised schemas, or raw JSON, and tool-choice policies map directly to `session.tool_choice`.
- When the relay isn't running at `http://localhost:8081`, set `NEXT_PUBLIC_REALTIME_SERVER_URL` in `webapp/.env` so the UI can reach `/tools`, `/public-url`, and the `/logs` websocket.

The server merges UI overrides with environment defaults from `websocket-server/.env`, so production deployments can lock down required settings while still allowing call-by-call experimentation.

### Life of a phone call

Setup

1. We run ngrok to make our server reachable by Twilio
1. We set the Twilio webhook to our ngrok address
1. Frontend connects to the backend (`wss://[your_backend]/logs`), ready for a call

Call

1. Call is placed to Twilio-managed number
1. Twilio queries the webhook (`http://[your_backend]/twiml`) for TwiML instructions
1. Twilio opens a bi-directional stream to the backend (`wss://[your_backend]/call`)
1. The backend connects to the Realtime API, and starts forwarding messages:
   - between Twilio and the Realtime API
   - between the frontend and the Realtime API

### Function Calling

This demo mocks out function calls so you can provide sample responses. In reality you could handle the function call, execute some code, and then supply the response back to the model.

## Full Setup

1. Make sure your [auth & env](#detailed-auth--env) is configured correctly.

2. Run webapp.

```shell
cd webapp
npm install
npm run dev
```

3. Run websocket server.

```shell
cd websocket-server
npm install
npm run dev
```

## Detailed Auth & Env

### OpenAI & Twilio

Set your credentials in `webapp/.env` and `websocket-server` - see `webapp/.env.example` and `websocket-server.env.example` for reference.

- `websocket-server/.env` now controls realtime defaults (model, codecs, noise reduction, turn detection). Keep production-safe values there and only expose non-sensitive overrides via the UI.

### Ngrok

Twilio needs to be able to reach your websocket server. If you're running it locally, your ports are inaccessible by default. [ngrok](https://ngrok.com/) can make them temporarily accessible.

We have set the `websocket-server` to run on port `8081` by default, so that is the port we will be forwarding.

```shell
ngrok http 8081
```

Make note of the `Forwarding` URL. (e.g. `https://54c5-35-170-32-42.ngrok-free.app`)

### Websocket URL

Your server should now be accessible at the `Forwarding` URL when run, so set the `PUBLIC_URL` in `websocket-server/.env`. See `websocket-server/.env.example` for reference.

# Additional Notes

This repo isn't polished, and the security practices leave some to be desired. Please only use this as reference, and make sure to audit your app with security and engineering before deploying!
