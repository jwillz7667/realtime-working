# WebSocket Connection Debug Guide

## Step 1: Test HTTP Connection First

```bash
# Test if ngrok is forwarding HTTP correctly
curl https://realtime.ngrok.pro/public-url

# Expected: {"publicUrl":"..."}
```

## Step 2: Check Ngrok WebSocket Support

Static ngrok domains require a paid plan with WebSocket support. Check your ngrok dashboard:

1. Go to https://dashboard.ngrok.com/
2. Check your plan includes WebSocket support
3. Verify your domain is properly configured

## Step 3: Test WebSocket with a Simple Tool

```bash
# Install wscat if you don't have it
npm install -g wscat

# Test WebSocket connection
wscat -c wss://realtime.ngrok.pro/logs
```

**Expected result:** Connection successful and you see:
```json
{"type":"relay.hello","message":"Frontend subscribed to realtime event stream","timestamp":...}
```

**If you get an error:** The issue is with ngrok or the backend WebSocket configuration.

## Step 4: Check Backend WebSocket Server

Look at your backend terminal logs when you try to connect. You should see connection attempts logged.

## Step 5: Alternative - Use Localhost for Frontend Testing

If ngrok WebSocket is the issue, you can run the frontend locally connecting to localhost:

**Option A: Set env var to localhost**
```bash
# In webapp/.env
NEXT_PUBLIC_REALTIME_SERVER_URL=http://localhost:8081
```

Then restart frontend:
```bash
cd webapp
npm run dev
```

This bypasses ngrok for frontend-to-backend communication (but Twilio still uses ngrok).

## Common Issues

### Issue 1: Ngrok Free Plan
Free ngrok doesn't support WebSocket on static domains. You need:
- Ngrok Pro plan or higher
- OR use dynamic domains for development

### Issue 2: Ngrok Not Started with Correct Command
Make sure you're running:
```bash
ngrok http 8081 --domain=realtime.ngrok.pro
```

NOT:
```bash
ngrok http 8081  # Wrong - creates new random domain
```

### Issue 3: Browser HTTPS -> WS Downgrade
If frontend is on HTTPS (Vercel), it can't connect to WS (non-secure WebSocket). Must use WSS.

If frontend is on HTTP (localhost), it CAN connect to WS or WSS.

### Issue 4: Port Already in Use
Check if port 8081 is actually running your app:
```bash
lsof -i :8081
```

Should show node process.
