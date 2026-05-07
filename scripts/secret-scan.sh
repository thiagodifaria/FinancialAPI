#!/usr/bin/env bash
set -euo pipefail

if rg -n --hidden \
  --glob '!.git/**' \
  --glob '!.cache/**' \
  --glob '!scripts/secret-scan.sh' \
  --glob '!**/node_modules/**' \
  --glob '!**/dist/**' \
  --glob '!**/package-lock.json' \
  '(AKIA[0-9A-Z]{16}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|sk_live_|whsec_[A-Za-z0-9_-]{20,})' .; then
  echo "Possível secret encontrado." >&2
  exit 1
fi
