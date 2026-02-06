#!/bin/bash
# ─── WorkBench Voice Agent — Vapi Setup ───────────────────────────────
# Run this from your Mac: cd ~/novai-website/gtm && bash vapi-setup.sh
# Creates the WorkBench GTM voice agent on your Vapi account

VAPI_KEY="63a966f6-cbf5-4915-827c-5f82b6cdf0b6"

echo "Creating WorkBench GTM Agent on Vapi..."

RESPONSE=$(curl -s -X POST "https://api.vapi.ai/assistant" \
  -H "Authorization: Bearer $VAPI_KEY" \
  -H "Content-Type: application/json" \
  -d @vapi-assistant-config.json)

# Extract assistant ID
ASSISTANT_ID=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id','ERROR'))" 2>/dev/null)

if [ "$ASSISTANT_ID" = "ERROR" ] || [ -z "$ASSISTANT_ID" ]; then
  echo "Error creating assistant:"
  echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
  exit 1
fi

echo ""
echo "✅ WorkBench GTM Agent created!"
echo "   Assistant ID: $ASSISTANT_ID"
echo "   Dashboard: https://dashboard.vapi.ai/assistants/$ASSISTANT_ID"
echo ""
echo "Next steps:"
echo "  1. Go to dashboard.vapi.ai → Phone Numbers"
echo "  2. Buy or assign a number to this assistant"
echo "  3. Or use the web widget with Public Key: 6c4b7bf5-65ba-4855-aebb-1778f7c8994c"
echo ""
echo "Test it now:"
echo "  curl -s -X POST 'https://api.vapi.ai/call/phone' \\"
echo "    -H 'Authorization: Bearer $VAPI_KEY' \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"assistantId\": \"$ASSISTANT_ID\", \"customer\": {\"number\": \"+12139433042\"}}'"
echo ""
echo "Webhook URL (already configured): https://workbench.novaisystems.online/_wb-voice/webhook"
