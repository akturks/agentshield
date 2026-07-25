#!/usr/bin/env bash
# Installs the public site and the tunnel as launchd agents so both survive
# logout and restart on crash. Observation gaps are unrecoverable data, so
# uptime is part of the instrument.

set -euo pipefail

REPO="/Users/serdar/projects/agentshield"
NODE="$(command -v node)"
CLOUDFLARED="$(command -v cloudflared)"
AGENTS="$HOME/Library/LaunchAgents"
LOGS="$REPO/public-site/logs"

mkdir -p "$AGENTS" "$LOGS"

cat > "$AGENTS/com.agentshield.publicsite.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.agentshield.publicsite</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE</string>
    <string>$REPO/public-site/server.js</string>
  </array>
  <key>WorkingDirectory</key><string>$REPO</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$LOGS/publicsite.log</string>
  <key>StandardErrorPath</key><string>$LOGS/publicsite.err.log</string>
</dict>
</plist>
EOF

cat > "$AGENTS/com.agentshield.console.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.agentshield.console</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE</string>
    <string>$REPO/public-site/console/server.js</string>
  </array>
  <key>WorkingDirectory</key><string>$REPO</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$LOGS/console.log</string>
  <key>StandardErrorPath</key><string>$LOGS/console.err.log</string>
</dict>
</plist>
EOF

cat > "$AGENTS/com.agentshield.cloudflared.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.agentshield.cloudflared</string>
  <key>ProgramArguments</key>
  <array>
    <string>$CLOUDFLARED</string>
    <string>tunnel</string>
    <string>run</string>
    <string>agentshield-site</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$LOGS/cloudflared.log</string>
  <key>StandardErrorPath</key><string>$LOGS/cloudflared.err.log</string>
</dict>
</plist>
EOF

cat > "$AGENTS/com.agentshield.backup.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.agentshield.backup</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$REPO/public-site/deploy/backup-reality.sh</string>
  </array>
  <key>WorkingDirectory</key><string>$REPO</string>
  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>4</integer><key>Minute</key><integer>17</integer></dict>
  <key>RunAtLoad</key><false/>
  <key>StandardOutPath</key><string>$LOGS/backup.log</string>
  <key>StandardErrorPath</key><string>$LOGS/backup.err.log</string>
</dict>
</plist>
EOF

# Any hand-started copies would hold the port that launchd now wants.
pkill -f "public-site/server.js" 2>/dev/null || true
pkill -f "public-site/console/server.js" 2>/dev/null || true
pkill -f "cloudflared tunnel run" 2>/dev/null || true
sleep 1

for label in com.agentshield.publicsite com.agentshield.console com.agentshield.cloudflared com.agentshield.backup; do
  launchctl unload -w "$AGENTS/$label.plist" 2>/dev/null || true
  launchctl load -w "$AGENTS/$label.plist"
  echo "loaded $label"
done

sleep 3
launchctl list | grep agentshield || true

cat <<EOF

Logs: $LOGS

The Mac must stay awake or observation stops:

    sudo pmset -a sleep 0 disablesleep 1

To stop:

    launchctl unload -w $AGENTS/com.agentshield.publicsite.plist
    launchctl unload -w $AGENTS/com.agentshield.console.plist
    launchctl unload -w $AGENTS/com.agentshield.cloudflared.plist

The console is at http://127.0.0.1:8090 and is bound to loopback. It is never
routed through the tunnel: it can publish findings, so it must not be reachable
from outside this machine.
EOF
