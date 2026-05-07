#!/usr/bin/env bash
set -euo pipefail

for file in service-api/service-postgresql/migrations/*.sql; do
  if [[ ! "$(basename "$file")" =~ ^[0-9]{3}_.+\.sql$ && "$(basename "$file")" != "001.sql" ]]; then
    echo "Migration fora do padrão: $file" >&2
    exit 1
  fi
  if grep -nE 'DROP TABLE|TRUNCATE|DELETE FROM (transactions|entries|audit_logs)' "$file"; then
    echo "Operação SQL destrutiva detectada em $file" >&2
    exit 1
  fi
done
