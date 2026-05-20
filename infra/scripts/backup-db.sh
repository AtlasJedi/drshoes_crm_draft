#!/usr/bin/env bash
# Dr Shoes — nightly Postgres dump → Cloudflare R2.
# Cron: 0 3 * * * /opt/drshoes/infra/scripts/backup-db.sh >> /var/log/drshoes-backup.log 2>&1
set -euo pipefail

REPO_ROOT="/opt/drshoes"
COMPOSE_FILE="${REPO_ROOT}/infra/docker-compose.prod.yml"
ENV_FILE="${REPO_ROOT}/.env.prod"
RETAIN_DAYS=30

# Load DB + R2 credentials
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

# Backup bucket is separate from the photos bucket so it can have different
# retention / access policies. Create it manually in Cloudflare R2 dashboard.
BACKUP_BUCKET="${R2_BUCKET}-backups"
DATE=$(date -u +%Y-%m-%dT%H%M%SZ)
KEY="db/${DATE}.sql.zst"

export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY"
export AWS_SECRET_ACCESS_KEY="$R2_SECRET_KEY"
export AWS_DEFAULT_REGION=auto

log() { echo "[$(date -u +%FT%TZ)] $*"; }

log "Dumping ${POSTGRES_DB} → s3://${BACKUP_BUCKET}/${KEY}"

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres \
    pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" \
    | zstd -19 \
    | aws s3 cp - "s3://${BACKUP_BUCKET}/${KEY}" --endpoint-url "$R2_ENDPOINT"

log "Uploaded ${KEY}"

# Prune dumps older than RETAIN_DAYS
CUTOFF=$(date -u -d "${RETAIN_DAYS} days ago" +%Y-%m-%d)
log "Pruning anything before ${CUTOFF}"

aws s3 ls "s3://${BACKUP_BUCKET}/db/" --endpoint-url "$R2_ENDPOINT" \
  | awk '{print $1, $4}' \
  | while read -r ddate fname; do
      [ -z "${fname:-}" ] && continue
      if [[ "$ddate" < "$CUTOFF" ]]; then
          aws s3 rm "s3://${BACKUP_BUCKET}/db/${fname}" --endpoint-url "$R2_ENDPOINT"
          log "Pruned ${fname}"
      fi
  done
