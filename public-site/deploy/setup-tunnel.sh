#!/usr/bin/env bash
# Creates the Cloudflare tunnel for agentshieldaidefense.com and points DNS at it.
#
# Run `cloudflared tunnel login` first — that step opens a browser and cannot be
# automated. Everything after it lives here. Safe to re-run: each step is skipped
# if it has already been done.

set -euo pipefail

TUNNEL_NAME="agentshield-site"
DOMAIN="agentshieldaidefense.com"
LOCAL_PORT="${PUBLIC_SITE_PORT:-8080}"
CF_DIR="$HOME/.cloudflared"

if [ ! -f "$CF_DIR/cert.pem" ]; then
  echo "error: $CF_DIR/cert.pem not found."
  echo "Run this first, pick $DOMAIN in the browser, then re-run this script:"
  echo
  echo "    cloudflared tunnel login"
  exit 1
fi

if cloudflared tunnel list 2>/dev/null | grep -q " $TUNNEL_NAME "; then
  echo "tunnel '$TUNNEL_NAME' already exists"
else
  echo "creating tunnel '$TUNNEL_NAME'..."
  cloudflared tunnel create "$TUNNEL_NAME"
fi

TUNNEL_ID="$(cloudflared tunnel list --output json \
  | python3 -c "import json,sys;print(next(t['id'] for t in json.load(sys.stdin) if t['name']=='$TUNNEL_NAME'))")"

echo "tunnel id: $TUNNEL_ID"

# Creates proxied CNAMEs to <id>.cfargotunnel.com — no A record is involved.
echo "routing DNS..."
cloudflared tunnel route dns --overwrite-dns "$TUNNEL_NAME" "$DOMAIN"
cloudflared tunnel route dns --overwrite-dns "$TUNNEL_NAME" "www.$DOMAIN"

cat > "$CF_DIR/config.yml" <<EOF
tunnel: $TUNNEL_ID
credentials-file: $CF_DIR/$TUNNEL_ID.json

ingress:
  - hostname: $DOMAIN
    service: http://127.0.0.1:$LOCAL_PORT
  - hostname: www.$DOMAIN
    service: http://127.0.0.1:$LOCAL_PORT
  - service: http_status:404
EOF

echo "wrote $CF_DIR/config.yml"
echo
echo "Validating..."
cloudflared tunnel ingress validate

cat <<EOF

Done. Start it with:

    cloudflared tunnel run $TUNNEL_NAME

Or install both services to run at login and restart on crash:

    bash $(dirname "$0")/install-services.sh

Then check the Cloudflare dashboard for $DOMAIN:
  Security -> Bots -> "Block AI Scrapers and Crawlers"  MUST BE OFF
  Bot Fight Mode                                        OFF
  SSL/TLS encryption mode                               Full
Blocking AI crawlers would defeat the purpose of this site.
EOF
