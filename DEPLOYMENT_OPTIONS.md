# Deployment Options

You have multiple ways to deploy this application depending on your needs.

## Option 1: Local Backend + Static Ngrok (Recommended for Development)

**Best for:** Development, testing, demos without monthly hosting costs

### Setup

1. **Run the backend locally:**
   ```bash
   cd websocket-server
   npm install
   npm run dev
   ```

2. **Start ngrok with your static domain:**
   ```bash
   ngrok http 8081 --domain=realtime.ngrok.pro
   ```

3. **Configure websocket-server/.env:**
   ```bash
   OPENAI_API_KEY=sk-...
   PUBLIC_URL=https://realtime.ngrok.pro
   # ... other optional vars
   ```

4. **Deploy frontend to Vercel:**
   ```bash
   cd webapp
   vercel
   ```

   Set Vercel environment variables:
   ```
   TWILIO_ACCOUNT_SID=AC...
   TWILIO_AUTH_TOKEN=...
   NEXT_PUBLIC_REALTIME_SERVER_URL=https://realtime.ngrok.pro
   TWILIO_OUTBOUND_NUMBER=+15551234567  # optional
   ```

5. **Configure Twilio webhook:**
   - URL: `https://realtime.ngrok.pro/twiml`

### Pros
- ✅ Static domain (doesn't change between restarts)
- ✅ Free backend hosting (runs on your machine)
- ✅ Easy to debug locally
- ✅ Fast iteration during development
- ✅ Full control over backend

### Cons
- ❌ Backend must be running on your machine
- ❌ No auto-restart if backend crashes
- ❌ Your machine must be online for calls to work

---

## Option 2: Railway Backend + Vercel Frontend (Recommended for Production)

**Best for:** Production, 24/7 availability, no local dependencies

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete instructions.

### Quick Overview

1. **Deploy backend to Railway:**
   ```bash
   cd websocket-server
   railway init
   railway up
   ```

   Environment variables:
   ```
   OPENAI_API_KEY=sk-...
   PUBLIC_URL=https://your-app.railway.app
   ```

2. **Deploy frontend to Vercel:**
   ```bash
   cd webapp
   vercel
   ```

   Environment variables:
   ```
   TWILIO_ACCOUNT_SID=AC...
   TWILIO_AUTH_TOKEN=...
   NEXT_PUBLIC_REALTIME_SERVER_URL=https://your-app.railway.app
   ```

3. **Configure Twilio webhook:**
   - URL: `https://your-app.railway.app/twiml`

### Pros
- ✅ 24/7 availability
- ✅ Auto-restart on crashes
- ✅ No local dependencies
- ✅ Easy scaling
- ✅ Professional deployment

### Cons
- ❌ Monthly hosting cost (~$5-15)
- ❌ Slightly harder to debug
- ❌ Need to redeploy for changes

---

## Option 3: Hybrid (Local Backend During Dev, Railway for Production)

**Best for:** Active development with production deployment

### Development Workflow

1. **Use static ngrok for local development:**
   ```bash
   # Terminal 1: Backend
   cd websocket-server
   npm run dev

   # Terminal 2: Ngrok
   ngrok http 8081 --domain=realtime.ngrok.pro

   # Terminal 3: Frontend
   cd webapp
   npm run dev
   ```

2. **Environment configuration:**

   `websocket-server/.env`:
   ```bash
   OPENAI_API_KEY=sk-...
   PUBLIC_URL=https://realtime.ngrok.pro
   ```

   `webapp/.env.local`:
   ```bash
   TWILIO_ACCOUNT_SID=AC...
   TWILIO_AUTH_TOKEN=...
   NEXT_PUBLIC_REALTIME_SERVER_URL=https://realtime.ngrok.pro
   ```

3. **Twilio webhook:**
   - URL: `https://realtime.ngrok.pro/twiml`

### Production Deployment

When ready to deploy:

1. **Deploy backend to Railway** (keep it running 24/7)
2. **Deploy frontend to Vercel**
3. **Update Twilio webhook** to Railway URL
4. **Switch back to ngrok URL** when developing locally

### Switching Between Environments

**To use local backend:**
```bash
# Update Twilio webhook
https://realtime.ngrok.pro/twiml

# Update Vercel env var (if using deployed frontend)
NEXT_PUBLIC_REALTIME_SERVER_URL=https://realtime.ngrok.pro

# Start local backend + ngrok
npm run dev
ngrok http 8081 --domain=realtime.ngrok.pro
```

**To use Railway backend:**
```bash
# Update Twilio webhook
https://your-app.railway.app/twiml

# Update Vercel env var
NEXT_PUBLIC_REALTIME_SERVER_URL=https://your-app.railway.app
```

---

## Comparison Table

| Feature | Local + Ngrok | Railway + Vercel | Hybrid |
|---------|---------------|------------------|--------|
| **Backend Cost** | Free | ~$5-15/month | Free (dev) / Paid (prod) |
| **Frontend Cost** | Free (Vercel) | Free (Vercel) | Free |
| **24/7 Availability** | ❌ | ✅ | ✅ (production) |
| **Easy Debugging** | ✅ | ❌ | ✅ (development) |
| **Auto-Restart** | ❌ | ✅ | Mixed |
| **Setup Complexity** | Low | Medium | High |
| **Best For** | Development | Production | Both |

---

## Using Your Static Ngrok Domain

With `https://realtime.ngrok.pro`, you get:

1. **Persistent URL** - Never changes between restarts
2. **Custom domain** - Professional-looking URL
3. **TLS/SSL** - Automatic HTTPS
4. **No configuration updates** - Set once in Twilio webhook

### Start ngrok with static domain:

```bash
ngrok http 8081 --domain=realtime.ngrok.pro
```

### Set PUBLIC_URL:

`websocket-server/.env`:
```bash
PUBLIC_URL=https://realtime.ngrok.pro
```

### Configure Twilio:

Webhook URL: `https://realtime.ngrok.pro/twiml`

That's it! Your static domain will work exactly like Railway, but routes traffic to your local machine.

---

## Recommended Approach

**For your use case with static ngrok domain:**

1. **Start with Option 1** (Local + Static Ngrok)
   - Free to run
   - Easy to debug
   - Quick iteration
   - Static domain means no webhook updates

2. **Deploy to Railway when:**
   - You need 24/7 availability
   - Multiple people need to access it
   - You want to demo without running locally
   - You're ready for production

3. **Use Option 3** (Hybrid) for:
   - Active development with production system running
   - A/B testing changes locally before deploying
   - Cost optimization (dev locally, deploy for demos/production)

---

## Next Steps

Choose your deployment option:

- **Option 1 (Local + Ngrok):** See below ⬇️
- **Option 2 (Railway):** See [DEPLOYMENT.md](DEPLOYMENT.md)
- **Option 3 (Hybrid):** Combine both approaches

## Quick Start: Local Backend + Static Ngrok + Vercel Frontend

### 1. Configure Backend (Local)

`websocket-server/.env`:
```bash
OPENAI_API_KEY=sk-...
PUBLIC_URL=https://realtime.ngrok.pro

# Optional settings (see .env.example for full list)
OPENAI_REALTIME_MODEL=gpt-realtime-2025-08-28
OPENAI_SESSION_INSTRUCTIONS="You are a helpful assistant"
OPENAI_DEFAULT_VOICE=marin
OPENAI_AUDIO_INPUT_FORMAT_TYPE=g711_ulaw
OPENAI_AUDIO_OUTPUT_FORMAT_TYPE=g711_ulaw
OPENAI_TRANSCRIPTION_MODEL=whisper-1
```

### 2. Start Backend + Ngrok

```bash
# Terminal 1: Backend
cd websocket-server
npm install
npm run dev

# Terminal 2: Ngrok
ngrok http 8081 --domain=realtime.ngrok.pro
```

### 3. Deploy Frontend to Vercel

```bash
cd webapp
npm install
vercel
```

**Vercel Environment Variables:**
```
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
NEXT_PUBLIC_REALTIME_SERVER_URL=https://realtime.ngrok.pro
TWILIO_OUTBOUND_NUMBER=+15551234567
```

### 4. Configure Twilio

1. Go to [Twilio Console](https://console.twilio.com) → Phone Numbers
2. Select your number
3. Voice Configuration:
   - A call comes in: `https://realtime.ngrok.pro/twiml`
   - HTTP Method: GET or POST
4. Save

### 5. Test

1. Open your Vercel URL (e.g., `https://your-app.vercel.app`)
2. Verify checklist is green
3. Call your Twilio number
4. Watch real-time transcripts appear!

### 6. Keep Running

**Important:** For calls to work, you need to keep running:
- ✅ Backend: `npm run dev` in `websocket-server/`
- ✅ Ngrok: `ngrok http 8081 --domain=realtime.ngrok.pro`

The frontend is deployed to Vercel, so it's always available. Only the backend needs to run locally.

---

## Troubleshooting

### "Cannot connect to backend"
- Ensure backend is running: `cd websocket-server && npm run dev`
- Ensure ngrok is running: `ngrok http 8081 --domain=realtime.ngrok.pro`
- Check `NEXT_PUBLIC_REALTIME_SERVER_URL` in Vercel matches ngrok domain

### "Twilio webhook failed"
- Verify `PUBLIC_URL` in `.env` matches ngrok domain
- Test: `curl https://realtime.ngrok.pro/twiml`
- Ensure ngrok and backend are both running

### "Audio not working"
- Check backend logs for `[Realtime]` errors
- Verify `OPENAI_API_KEY` is set correctly
- Ensure audio format is `g711_ulaw` (default)
