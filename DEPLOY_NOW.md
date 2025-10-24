# Deploy to Railway and Vercel - Quick Guide

Code is pushed to: `https://github.com/jwillz7667/realtime-working`

## Step 1: Deploy Backend to Railway

### Option A: Via Railway Dashboard (Easiest)

1. Go to https://railway.app/new
2. Click **Deploy from GitHub repo**
3. Select repository: `jwillz7667/realtime-working`
4. Railway will ask which directory to deploy
5. **IMPORTANT:** Set **Root Directory** to `websocket-server`
6. Click **Deploy**

### Option B: Via Railway CLI

```bash
cd websocket-server
railway login
railway init
# Select: Create new project
# Name it: realtime-backend
railway up
```

### Configure Environment Variables

Once deployed, add these in Railway dashboard (Settings → Variables):

```
OPENAI_API_KEY=your-openai-key-here
PUBLIC_URL=<your-railway-domain>
```

**Get your Railway domain:**
- Go to Settings → Domains
- You'll see something like `realtime-backend-production.up.railway.app`
- Copy the full URL: `https://realtime-backend-production.up.railway.app`
- Set that as `PUBLIC_URL`

### Verify Backend

Visit: `https://your-railway-domain.railway.app/`

Should return:
```json
{
  "status": "ok",
  "message": "WebSocket server is running",
  ...
}
```

---

## Step 2: Deploy Frontend to Vercel

### Option A: Via Vercel Dashboard (Easiest)

1. Go to https://vercel.com/new
2. Import Git Repository: `jwillz7667/realtime-working`
3. **IMPORTANT:** Configure project:
   - **Framework Preset:** Next.js
   - **Root Directory:** `webapp`
   - **Build Command:** `npm run build`
   - **Output Directory:** `.next`
4. Click **Deploy**

### Option B: Via Vercel CLI

```bash
cd webapp
npm install -g vercel
vercel
```

When prompted:
- Set up and deploy? **Y**
- Which scope? (select your account)
- Link to existing project? **N**
- What's your project's name? `realtime-frontend`
- In which directory is your code located? `./` (already in webapp)
- Override settings? **N**

### Configure Environment Variables

In Vercel dashboard (Settings → Environment Variables):

```
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=your-twilio-auth-token
NEXT_PUBLIC_REALTIME_SERVER_URL=https://your-railway-domain.railway.app
TWILIO_OUTBOUND_NUMBER=+1234567890
```

**Then redeploy:**
- Go to Deployments tab
- Click the three dots on latest deployment
- Click **Redeploy**

---

## Step 3: Configure Twilio Webhook

1. Go to https://console.twilio.com/us1/develop/phone-numbers/manage/incoming
2. Click your phone number
3. Under **Voice Configuration**:
   - **A call comes in:** `https://your-railway-domain.railway.app/twiml`
   - **HTTP Method:** POST
4. Click **Save configuration**

---

## Step 4: Test Everything

1. Open your Vercel URL: `https://your-app.vercel.app`
2. Call your Twilio number
3. You should:
   - Hear the AI assistant
   - See real-time transcripts in the webapp
   - Call automatically records
4. Check Twilio Console → Monitor → Logs → Recordings

---

## Troubleshooting

### Backend not accessible
```bash
# Check Railway logs
railway logs
```

### Frontend can't connect to backend
- Verify `NEXT_PUBLIC_REALTIME_SERVER_URL` in Vercel matches Railway URL
- Check Railway logs for WebSocket connection attempts

### Twilio webhook fails
- Test: `curl https://your-railway-url.railway.app/twiml`
- Should return XML with Stream URL

---

## Quick Reference

**Your GitHub Repo:** https://github.com/jwillz7667/realtime-working

**Railway Backend:** https://railway.app/dashboard
**Vercel Frontend:** https://vercel.com/dashboard
**Twilio Console:** https://console.twilio.com

**After deployment, you'll have:**
- Backend: `https://your-app.railway.app`
- Frontend: `https://your-app.vercel.app`
- Twilio webhook: `https://your-app.railway.app/twiml`
