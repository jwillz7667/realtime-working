#!/bin/bash

echo "=== Testing Ngrok WebSocket Connection ==="
echo ""

echo "1. Testing HTTP endpoint..."
HTTP_RESULT=$(curl -s https://realtime.ngrok.pro/public-url)
echo "Result: $HTTP_RESULT"
echo ""

echo "2. Testing WebSocket endpoint with curl..."
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: SGVsbG8sIHdvcmxkIQ==" \
  https://realtime.ngrok.pro/logs

echo ""
echo ""
echo "3. Check if wscat is installed..."
if command -v wscat &> /dev/null; then
    echo "wscat found. Testing WebSocket connection..."
    timeout 5 wscat -c wss://realtime.ngrok.pro/logs || echo "Connection failed or timed out"
else
    echo "wscat not found. Install with: npm install -g wscat"
fi
