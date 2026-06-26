#!/bin/bash
# Пересборка из git-клона (для случаев, когда pixeldrain недоступен с сервера).
# Запуск на сервере: bash /opt/cf_new/redeploy.sh
set -e
SRC="$(cd "$(dirname "$0")" && pwd)"
APP=/opt/condr_faceit
echo ">>> Источник: $SRC -> $APP"
cp -rf "$SRC/backend" "$SRC/frontend" "$SRC/docker-compose.tunnel.yml" "$APP/"
cd "$APP"
echo ">>> Чищу Docker-кэш..."
docker builder prune -af || true
docker image prune -f || true
echo ">>> Пересобираю контейнеры..."
docker compose -f docker-compose.tunnel.yml --env-file .env.production up -d --build --remove-orphans
docker image prune -af || true
echo ">>> REDEPLOY DONE"
