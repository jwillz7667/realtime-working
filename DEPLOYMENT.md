# Deployment Guide

This guide covers deploying the websocket-server to Railway and the webapp to Vercel.

## Prerequisites

- Railway account ([railway.app](https://railway.app))
- Vercel account ([vercel.com](https://vercel.com))
- Twilio account with a phone number
- OpenAI API key with Realtime API access

## Part 1: Deploy WebSocket Server to Railway

### 1.1 Create Railway Project

1. Go to [railway.app](https://railway.app) and sign in
2. Click **New Project**
3. Select **Deploy from GitHub repo**
4. Choose this repository
5. Select the `websocket-server` directory (Railway will auto-detect it as a Node.js project)

Alternatively, use Railway CLI:

```bash
cd websocket-server
railway init
railway up
```

### 1.2 Configure Environment Variables

In your Railway project dashboard, go to **Variables** and add:

**Required:**
- `OPENAI_API_KEY` - Your OpenAI API key
- `PUBLIC_URL` - Will be set after deployment (see step 1.3)

**Optional (with recommended production values):**
- `OPENAI_REALTIME_MODEL=gpt-realtime-2025-08-28`
- `OPENAI_SESSION_INSTRUCTIONS=You are a realtime assistant that keeps responses concise, clear, and warm.`
- `OPENAI_DEFAULT_VOICE=marin`
- `OPENAI_AUDIO_INPUT_FORMAT_TYPE=g711_ulaw`
- `OPENAI_AUDIO_INPUT_SAMPLE_RATE=8000`
- `OPENAI_AUDIO_OUTPUT_FORMAT_TYPE=g711_ulaw`
- `OPENAI_AUDIO_OUTPUT_SAMPLE_RATE=8000`
- `OPENAI_AUDIO_INPUT_NOISE_REDUCTION=near_field`
- `OPENAI_TURN_DETECTION_JSON={"type":"semantic_vad","eagerness":"auto","eager_response_ms":220,"silence_duration_ms":200,"prefix_padding_ms":250,"interrupt_response":true,"create_response":true}`
- `OPENAI_TOOL_CHOICE=auto`
- `OPENAI_DEFAULT_TOOLS_JSON=[]`
- `OPENAI_DEFAULT_MCP_JSON=[]`
- `OPENAI_TRANSCRIPTION_MODEL=whisper-1`

### 1.3 Get Railway Domain and Set PUBLIC_URL

1. After deployment, Railway will assign a domain like `your-app.railway.app`
2. Copy the full URL (e.g., `https://your-app.railway.app`)
3. Go back to **Variables** and set:
   - `PUBLIC_URL=https://your-app.railway.app`
4. Railway will automatically redeploy

### 1.4 Test the Deployment

Visit your Railway URL endpoints:

```bash
# Check if server is running
curl https://your-app.railway.app/public-url

# Should return: {"publicUrl":"https://your-app.railway.app"}

# Check tools endpoint
curl https://your-app.railway.app/tools

# Should return: JSON array of function schemas
```

## Part 2: Deploy WebApp to Vercel

### 2.1 Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **Add New...** → **Project**
3. Import your Git repository
4. Configure:
   - **Framework Preset:** Next.js
   - **Root Directory:** `webapp`
   - Click **Deploy**

Alternatively, use Vercel CLI:

```bash
cd webapp
npm install -g vercel
vercel
```

### 2.2 Configure Environment Variables

In your Vercel project dashboard, go to **Settings** → **Environment Variables** and add:

**Required:**
- `TWILIO_ACCOUNT_SID` - Your Twilio Account SID (starts with AC...)
- `TWILIO_AUTH_TOKEN` - Your Twilio Auth Token

**Optional:**
- `TWILIO_OUTBOUND_NUMBER` - Default caller ID for outgoing calls (E.164 format, e.g., +15551234567)
- `TWILIO_TWIML_URL` - Leave blank to use Railway URL automatically
- `NEXT_PUBLIC_REALTIME_SERVER_URL` - Your Railway URL (e.g., `https://your-app.railway.app`)

After adding variables, redeploy from the **Deployments** tab.

## Part 3: Configure Twilio Webhook

### 3.1 Set Twilio Phone Number Webhook

1. Go to your [Twilio Console](https://console.twilio.com)
2. Navigate to **Phone Numbers** → **Manage** → **Active numbers**
3. Click on your phone number
4. Under **Voice Configuration**:
   - **Configure with:** Webhooks, TwiML Bins, Functions, Studio, or Proxy
   - **A call comes in:**
     - Set to: `https://your-railway-app.railway.app/twiml`
     - HTTP Method: `GET` or `POST` (both work)
5. Click **Save configuration**

## Part 4: Test the Full System

### 4.1 Test Inbound Calls

1. Open your Vercel deployment URL (e.g., `https://your-app.vercel.app`)
2. Verify the setup checklist shows all green checkmarks
3. Call your Twilio phone number
4. You should hear the assistant and see real-time transcripts in the webapp

### 4.2 Test Outbound Calls

1. In the webapp, enter a destination phone number (E.164 format)
2. Click **Start Outgoing Call**
3. The destination phone should ring
4. Answer and test the conversation

### 4.3 Test Call Recording

1. During an active call, click **Start Recording** in the webapp
2. Continue the conversation
3. Click **Stop Recording**
4. Check your Twilio Console for the recording

## Troubleshooting

### WebSocket Connection Issues

If the frontend can't connect to the websocket-server:

1. Verify `NEXT_PUBLIC_REALTIME_SERVER_URL` is set correctly in Vercel
2. Check Railway logs: `railway logs` or view in dashboard
3. Ensure Railway domain is accessible (check Railway deployment status)
4. Verify CORS is enabled (it's enabled by default in server.ts)

### Twilio Can't Reach Webhook

1. Verify `PUBLIC_URL` is set in Railway environment variables
2. Test the `/twiml` endpoint: `curl https://your-railway-app.railway.app/twiml`
3. Check Railway logs for incoming requests
4. Ensure the Railway app is deployed and running

### OpenAI Connection Failures

1. Verify `OPENAI_API_KEY` is set correctly in Railway
2. Check Railway logs for error messages with `[Realtime]` prefix
3. Ensure your OpenAI account has Realtime API access
4. Check OpenAI API status

### Audio Quality Issues

1. Verify audio format settings match Twilio's requirements:
   - Input/Output format: `g711_ulaw`
   - Sample rate: `8000`
2. Check noise reduction setting (try `near_field` vs `far_field`)
3. Review Railway logs for audio-related warnings

## Monitoring and Logs

### Railway Logs

View real-time logs:
```bash
railway logs
```

Or view in the Railway dashboard under **Deployments** → **View Logs**

### Vercel Logs

View logs in Vercel dashboard under **Deployments** → select deployment → **Functions**

### Environment Updates

To update environment variables:

**Railway:**
1. Update in Variables tab
2. Redeploy automatically happens

**Vercel:**
1. Update in Settings → Environment Variables
2. Manually redeploy from Deployments tab

## Cost Estimates

- **Railway:** Free tier includes $5/month credit; typical usage: ~$5-15/month
- **Vercel:** Free tier includes generous limits; should be free for most use cases
- **Twilio:** Pay per minute for calls (~$0.01-0.02/min)
- **OpenAI Realtime API:** Pay per audio token usage (~$0.06/min input, $0.24/min output)

## Production Considerations

This deployment is suitable for demos and testing. For production:

1. **Add authentication** to websocket endpoints
2. **Rate limiting** on API routes
3. **Input validation** on all user inputs
4. **Monitoring and alerting** (Railway/Vercel integrations)
5. **Database** for call logs and analytics
6. **Environment-specific configs** (staging vs production)
7. **Custom domain** for both Railway and Vercel deployments
8. **SSL/TLS** enforcement (enabled by default on both platforms)
9. **Error tracking** (Sentry, LogRocket, etc.)
10. **Load testing** before scaling to production traffic
