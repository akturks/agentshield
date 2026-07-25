#!/usr/bin/env bash
# Nightly snapshot of the two databases.
#
# Code can be rewritten; the observation record cannot. reality.db holds every
# request this site ever received, and git deliberately ignores it — it is
# state, it changes on every request, and it would never merge. So the only
# thing standing between that record and a dead disk is this script.
#
# sqlite3 .backup is used rather than cp: the site is serving while this runs,
# and copying a live WAL database yields a file that may not open. The backup
# API takes a consistent snapshot through the same locking the server uses, so
# nothing has to be stopped and no observation window is lost.

set -euo pipefail

REPO="/Users/serdar/projects/agentshield"
LOCAL="$HOME/Backups/agentshield"
# Test the Drive root, not the backup folder: the folder does not exist until
# the first run creates it, so testing it would skip the copy forever.
DRIVE="$HOME/Library/CloudStorage/GoogleDrive-akturkserdarr@gmail.com/Drive'ım"
REMOTE="$DRIVE/Backups/agentshield"
KEEP_DAYS=30
STAMP="$(date +%Y-%m-%d)"
SQLITE="$(command -v sqlite3)"

mkdir -p "$LOCAL"

snapshot() {
  local src="$1" name="$2"
  [ -f "$src" ] || { echo "skip $name: not found at $src"; return 0; }

  local out="$LOCAL/$name-$STAMP.db"
  "$SQLITE" "$src" ".backup '$out'"

  # An unreadable backup is worse than no backup, because it is believed.
  # Ask the file itself whether it survived before keeping it.
  local check
  check="$("$SQLITE" "$out" "PRAGMA integrity_check;" 2>&1 | head -1)"
  if [ "$check" != "ok" ]; then
    echo "FAILED $name: integrity_check said '$check'"
    rm -f "$out"
    return 1
  fi

  local rows=""
  if [ "$name" = "reality" ]; then
    rows="$("$SQLITE" "$out" "SELECT COUNT(*) FROM RequestReality;" 2>/dev/null || echo "?")"
    rows=" ($rows observations)"
  fi

  # integrity_check opened the snapshot, which left a WAL beside it.
  rm -f "$out-wal" "$out-shm"

  gzip -f "$out"
  echo "ok $name-$STAMP.db.gz$rows"
}

snapshot "$REPO/reality.db"     reality
snapshot "$REPO/agentshield.db" agentshield

# Off this machine. A copy on the same disk survives a mistake, not a failure.
if [ -d "$DRIVE" ]; then
  mkdir -p "$REMOTE"
  cp -f "$LOCAL"/*-"$STAMP".db.gz "$REMOTE"/ 2>/dev/null && echo "copied to Google Drive"
else
  echo "warning: Google Drive not mounted — local copy only, same disk as the original"
fi

find "$LOCAL" -name "*.db.gz" -mtime +$KEEP_DAYS -delete 2>/dev/null || true
[ -d "$REMOTE" ] && find "$REMOTE" -name "*.db.gz" -mtime +$KEEP_DAYS -delete 2>/dev/null || true

echo "$(date '+%Y-%m-%d %H:%M') done — keeping $KEEP_DAYS days"
