# Quick Deploy Checklist

Use this as a quick reference for deploying to Railway + Vercel.

## ✅ Pre-Deployment Checklist

- [ ] OpenAI API key with Realtime API access
- [ ] Twilio account with phone number
- [ ] Railway account
- [ ] Vercel account
- [ ] GitHub repo with latest code

## 🚂 Railway (Backend)

### Deploy
```bash
cd websocket-server
railway init
railway up
```

### Required Environment Variables
```
OPENAI_API_KEY=sk-...
PUBLIC_URL=https://your-app.railway.app
```

### Test Deployment
```bash
curl https://your-app.railway.app/public-url
curl https://your-app.railway.app/tools
```

## ▲ Vercel (Frontend)

### Deploy
```bash
cd webapp
vercel
```

### Required Environment Variables
```
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
NEXT_PUBLIC_REALTIME_SERVER_URL=https://your-app.railway.app
```

### Optional Environment Variables
```
TWILIO_OUTBOUND_NUMBER=+15551234567
```

## 📞 Twilio Configuration

1. Go to Twilio Console → Phone Numbers
2. Select your number
3. Voice Configuration → A call comes in:
   - URL: `https://your-app.railway.app/twiml`
   - Method: GET or POST
4. Save

## 🧪 Testing

1. Open Vercel URL in browser
2. Check setup checklist (should be all green)
3. Call Twilio number
4. Verify:
   - [ ] Call connects
   - [ ] Assistant responds
   - [ ] Transcript appears in real-time
   - [ ] Can interrupt assistant

## 🔍 Troubleshooting

### Frontend can't connect to backend
- Check `NEXT_PUBLIC_REALTIME_SERVER_URL` in Vercel
- Verify Railway app is running
- Check Railway logs

### Twilio webhook fails
- Verify `PUBLIC_URL` in Railway env vars
- Test: `curl https://your-app.railway.app/twiml`
- Check Railway logs for incoming requests

### OpenAI connection fails
- Verify `OPENAI_API_KEY` in Railway
- Check Railway logs for `[Realtime]` errors
- Confirm Realtime API access on OpenAI account

## 📊 Quick Commands

```bash
# Railway logs
railway logs

# Redeploy Railway
railway up

# Redeploy Vercel
cd webapp && vercel --prod

# Test backend locally
cd websocket-server && npm run dev

# Test frontend locally
cd webapp && npm run dev
```

## 💰 Cost Estimates

- Railway: ~$5-15/month
- Vercel: Free tier (for most use cases)
- Twilio: ~$0.01-0.02/minute
- OpenAI: ~$0.30/minute audio

---

For detailed instructions, see [DEPLOYMENT.md](DEPLOYMENT.md)
