#!/usr/bin/env sh
set -eu

cleanup() {
  if [ -n "${SCORING_PID:-}" ]; then
    kill "$SCORING_PID" 2>/dev/null || true
  fi
}

trap cleanup INT TERM EXIT

cd /app/scoring
/opt/scoring-venv/bin/python -m app &
SCORING_PID="$!"

cd /app/api
exec node dist/index.js
