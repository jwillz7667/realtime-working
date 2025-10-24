# Quick Setup with Static Ngrok Domain

Perfect for development with your `https://realtime.ngrok.pro` domain!

## 🎯 Overview

- **Backend:** Runs locally on your machine (free)
- **Ngrok:** Uses your static domain `https://realtime.ngrok.pro`
- **Frontend:** Deployed to Vercel (free)
- **Total Cost:** $0/month (just ngrok static domain subscription)

## ⚡ Quick Start (5 Minutes)

### Step 1: Configure Backend Environment

Create `websocket-server/.env`:

```bash
# Required
OPENAI_API_KEY=sk-proj-...
PUBLIC_URL=https://realtime.ngrok.pro

# Recommended settings for Twilio
OPENAI_REALTIME_MODEL=gpt-realtime-2025-08-28
OPENAI_SESSION_INSTRUCTIONS="You are a helpful assistant that keeps responses concise and clear."
OPENAI_DEFAULT_VOICE=marin
OPENAI_AUDIO_INPUT_FORMAT_TYPE=g711_ulaw
OPENAI_AUDIO_OUTPUT_FORMAT_TYPE=g711_ulaw
OPENAI_AUDIO_INPUT_SAMPLE_RATE=8000
OPENAI_AUDIO_OUTPUT_SAMPLE_RATE=8000
OPENAI_AUDIO_INPUT_NOISE_REDUCTION=near_field
OPENAI_TRANSCRIPTION_MODEL=whisper-1
OPENAI_TOOL_CHOICE=auto
OPENAI_DEFAULT_TOOLS_JSON=[]
OPENAI_DEFAULT_MCP_JSON=[]
```

### Step 2: Start Backend + Ngrok

Open two terminal windows:

**Terminal 1 - Backend:**
```bash
cd websocket-server
npm install
npm run dev
```

**Terminal 2 - Ngrok:**
```bash
ngrok http 8081 --domain=realtime.ngrok.pro
```

You should see:
```
Forwarding  https://realtime.ngrok.pro -> http://localhost:8081
```

### Step 3: Test Backend

```bash
# Test public URL endpoint
curl https://realtime.ngrok.pro/public-url
# Should return: {"publicUrl":"https://realtime.ngrok.pro"}

# Test tools endpoint
curl https://realtime.ngrok.pro/tools
# Should return: JSON array of function schemas
```

### Step 4: Deploy Frontend to Vercel

```bash
cd webapp
npm install
vercel
```

**When prompted:**
- Link to existing project? **N** (create new)
- Project name: (choose a name, e.g., `realtime-twilio-demo`)
- Directory: (press Enter, defaults to current)
- Override settings? **N**

**Add Environment Variables in Vercel Dashboard:**

1. Go to your project in [vercel.com](https://vercel.com)
2. Settings → Environment Variables
3. Add these variables:

```
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
NEXT_PUBLIC_REALTIME_SERVER_URL=https://realtime.ngrok.pro
TWILIO_OUTBOUND_NUMBER=+15551234567
```

4. Redeploy from Deployments tab

### Step 5: Configure Twilio Webhook

1. Go to [Twilio Console](https://console.twilio.com/us1/develop/phone-numbers/manage/incoming)
2. Click on your phone number
3. Under **Voice Configuration**:
   - **A call comes in:** `https://realtime.ngrok.pro/twiml`
   - **HTTP Method:** GET (or POST, both work)
4. Click **Save configuration**

### Step 6: Test Everything! 🎉

1. Open your Vercel URL (e.g., `https://your-app.vercel.app`)
2. Verify all checkmarks are green in the setup checklist
3. **Call your Twilio number** from your phone
4. You should:
   - Hear the AI assistant
   - See real-time transcripts in the webapp
   - Be able to have a conversation!

## 📋 Daily Usage

Every time you want to use the system:

```bash
# Terminal 1: Backend
cd websocket-server
npm run dev

# Terminal 2: Ngrok
ngrok http 8081 --domain=realtime.ngrok.pro
```

That's it! Keep both terminals running while you're using the system.

The frontend is deployed to Vercel, so you can access it anytime at your Vercel URL.

## 🔧 Configuration Tips

### Changing AI Behavior

Edit `websocket-server/.env`:

```bash
# Change the voice
OPENAI_DEFAULT_VOICE=alloy  # Options: alloy, echo, fable, onyx, nova, shimmer, marin

# Change instructions
OPENAI_SESSION_INSTRUCTIONS="You are a customer service agent. Be professional and helpful."

# Change model (if you have access to specific dated releases)
OPENAI_REALTIME_MODEL=gpt-realtime-2025-08-28
```

Restart backend: `npm run dev`

### Runtime Configuration

You can also change settings in real-time from the webapp:
1. Click **Session Configuration** panel
2. Modify any settings
3. Changes apply immediately to new calls

## 🐛 Troubleshooting

### "Cannot connect to backend"

**Check:**
```bash
# Is backend running?
curl http://localhost:8081/public-url

# Is ngrok running?
curl https://realtime.ngrok.pro/public-url

# Check NEXT_PUBLIC_REALTIME_SERVER_URL in Vercel
# Should be: https://realtime.ngrok.pro
```

**Fix:**
- Start backend: `cd websocket-server && npm run dev`
- Start ngrok: `ngrok http 8081 --domain=realtime.ngrok.pro`
- Verify Vercel env var is correct

### "Twilio webhook failed"

**Check:**
```bash
# Test TwiML endpoint
curl https://realtime.ngrok.pro/twiml

# Should return XML like:
# <?xml version="1.0" encoding="UTF-8"?>
# <Response>
#   <Connect>
#     <Stream url="wss://realtime.ngrok.pro/call" />
#   </Connect>
# </Response>
```

**Fix:**
- Verify `PUBLIC_URL=https://realtime.ngrok.pro` in `websocket-server/.env`
- Restart backend
- Check Twilio webhook URL is exactly: `https://realtime.ngrok.pro/twiml`

### "No audio" or "Call connects but silent"

**Check backend logs:**
```bash
# Look for errors with [Realtime] prefix in backend terminal
```

**Common issues:**
- Invalid `OPENAI_API_KEY`
- No Realtime API access on OpenAI account
- Audio format mismatch (should be `g711_ulaw`)

**Fix:**
- Verify API key is correct
- Check OpenAI account has Realtime API enabled
- Ensure env vars match example above

### "Call drops after few seconds"

**Check:**
- Both backend AND ngrok are still running
- Check backend logs for WebSocket errors
- Verify OpenAI API quota

### "Ngrok shows 502 Bad Gateway"

**Fix:**
- Backend not running → start it: `npm run dev`
- Wrong port → should be 8081
- Firewall blocking → check system firewall settings

## 💡 Pro Tips

### 1. Auto-start with tmux (Optional)

Create a startup script:

```bash
#!/bin/bash
# start-realtime.sh

tmux new-session -d -s realtime
tmux send-keys -t realtime "cd websocket-server && npm run dev" C-m
tmux split-window -h -t realtime
tmux send-keys -t realtime "ngrok http 8081 --domain=realtime.ngrok.pro" C-m
tmux attach -t realtime
```

Run: `bash start-realtime.sh`

### 2. Check if everything is running

```bash
# Quick health check
curl https://realtime.ngrok.pro/public-url && echo "✅ Backend + Ngrok OK"
curl https://your-app.vercel.app && echo "✅ Frontend OK"
```

### 3. View backend logs in real-time

Backend logs show:
- `[Realtime]` - OpenAI connection events
- Function calls
- Audio buffer commits
- Errors and warnings

Watch for these to debug issues.

### 4. Test locally before deploying frontend

```bash
# Terminal 1: Backend
cd websocket-server && npm run dev

# Terminal 2: Ngrok
ngrok http 8081 --domain=realtime.ngrok.pro

# Terminal 3: Frontend (local)
cd webapp && npm run dev

# Visit: http://localhost:3000
```

This lets you test changes before deploying to Vercel.

## 📊 Monitoring

### Check Active Calls

Twilio Console → Monitor → Logs → Calls

### Check OpenAI Usage

OpenAI Dashboard → Usage → Realtime API

### Check Costs

- **Ngrok:** Static domain subscription (already paid)
- **Vercel:** Free tier (should be $0)
- **Twilio:** ~$0.01-0.02 per minute
- **OpenAI:** ~$0.30 per minute of audio

**Cost per 10-minute call:** ~$3.10

## 🚀 Next Steps

### When you're ready for 24/7 deployment:

Switch to Railway + Vercel:
1. Stop local backend and ngrok
2. Deploy to Railway (see [DEPLOYMENT.md](DEPLOYMENT.md))
3. Update Vercel env var: `NEXT_PUBLIC_REALTIME_SERVER_URL=https://your-app.railway.app`
4. Update Twilio webhook: `https://your-app.railway.app/twiml`

### Want to keep both options?

You can switch between local and Railway:
- Local (dev): Use `https://realtime.ngrok.pro`
- Railway (prod): Use `https://your-app.railway.app`
- Just update Twilio webhook and Vercel env var to switch

---

## 📞 Support

If you run into issues:

1. Check troubleshooting section above
2. Review backend logs for `[Realtime]` errors
3. Check [DEPLOYMENT_OPTIONS.md](DEPLOYMENT_OPTIONS.md) for more details
4. File an issue on GitHub

---

**You're all set!** 🎉

Your static ngrok domain makes this setup perfect for development:
- ✅ No costs for backend hosting
- ✅ Easy to debug locally
- ✅ No webhook URL updates needed
- ✅ Professional static domain
