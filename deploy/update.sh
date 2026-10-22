#!/usr/bin/env bash
# Подтягивает новую версию из GitHub и перезапускает, только если что-то изменилось.
set -euo pipefail
cd /opt/vending
git fetch -q origin main
if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
  git reset -q --hard origin/main
  docker compose up -d --build --remove-orphans
  echo "$(date -Is) обновлено до $(git rev-parse --short HEAD)" >> data/updates.log
fi
