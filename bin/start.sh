#!/bin/bash
set -e

PORT="${PORT:-10000}"
MAX_WAIT=30

while [ $MAX_WAIT -gt 0 ]; do
  if python -c "import socket; s=socket.socket(); s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1); s.bind(('0.0.0.0', $PORT)); s.close()" 2>/dev/null; then
    break
  fi
  sleep 1
  MAX_WAIT=$((MAX_WAIT - 1))
done

exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
