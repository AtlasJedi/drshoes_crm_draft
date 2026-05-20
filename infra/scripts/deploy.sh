#!/usr/bin/env bash
# Dr Shoes — production deploy. Run as 'deploy' user.
# Idempotent: pulls latest code, rebuilds, brings up, health-checks, reloads Caddy.
set -euo pipefail

REPO_ROOT="/opt/drshoes"
COMPOSE_FILE="${REPO_ROOT}/infra/docker-compose.prod.yml"
ENV_FILE="${REPO_ROOT}/.env.prod"

cd "$REPO_ROOT"

[ -f "$ENV_FILE" ] || { echo "ERROR: $ENV_FILE missing — copy from infra/.env.prod.example and fill in values" >&2; exit 1; }
[ -f "$COMPOSE_FILE" ] || { echo "ERROR: $COMPOSE_FILE missing" >&2; exit 1; }

echo "==> Pulling latest code"
git fetch --all --tags
git pull --ff-only

echo "==> Building images"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build

echo "==> Bringing services up"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d

echo "==> Waiting for backend health (max 90s)"
for i in $(seq 1 90); do
    if curl -sf http://127.0.0.1:8080/actuator/health >/dev/null 2>&1; then
        echo "    backend healthy after ${i}s"
        break
    fi
    if [ "$i" -eq 90 ]; then
        echo "ERROR: backend failed health check after 90s" >&2
        docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs --tail=80 backend >&2
        exit 1
    fi
    sleep 1
done

echo "==> Reloading Caddy"
sudo systemctl reload caddy

SHA=$(git rev-parse --short HEAD)
SUBJ=$(git log -1 --format=%s)
echo "==> Deployed: ${SHA} (${SUBJ})"
