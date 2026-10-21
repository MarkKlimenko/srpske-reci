#!/usr/bin/env bash
# Serves the app over http:// so that IndexedDB and the service worker work.
#   ./start.sh            — localhost only
#   ./start.sh --lan      — also reachable from a phone on the same Wi-Fi
set -euo pipefail
cd "$(dirname "$0")"

BIND=127.0.0.1
LAN=0
PORT=8778
for arg in "$@"; do
  case "$arg" in
    --lan) BIND=0.0.0.0; LAN=1 ;;
    *[0-9]*) PORT="$arg" ;;
  esac
done

python3 -m http.server "$PORT" --bind "$BIND" >/dev/null 2>&1 &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null || true' EXIT
sleep 0.5

echo "Srpske reči: http://localhost:${PORT}/index.html   (Ctrl+C to stop)"
if [ "$LAN" = "1" ]; then
  IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "")
  if [ -n "$IP" ]; then
    echo "On the phone (same Wi-Fi): http://${IP}:${PORT}/index.html"
    echo "Note: over plain http the offline cache stays off — the Mac has to keep serving."
  else
    echo "Could not detect the LAN address; check System Settings > Network."
  fi
fi
open "http://localhost:${PORT}/index.html" 2>/dev/null || true
wait $SERVER_PID
