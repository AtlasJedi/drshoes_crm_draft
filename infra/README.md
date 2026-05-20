# Dr Shoes — production infra runbook

Production deployment for the Dr Shoes admin CRM. Targets a single Hetzner Cloud
VPS (CAX11 / Ubuntu 24.04), with host-level Caddy in front of a docker-compose
stack of Postgres + Spring Boot + Next.js. Photos and DB backups go to
Cloudflare R2.

## Layout

```
infra/
  Caddyfile.prod              # symlinked to /etc/caddy/Caddyfile during install
  docker-compose.prod.yml     # standalone prod stack (no MinIO, no Jaeger)
  .env.prod.example           # template — copy to /opt/drshoes/.env.prod
  scripts/
    install-server.sh         # one-time root-level host hardening
    deploy.sh                 # idempotent redeploy (pull → build → up → health → reload)
    backup-db.sh              # nightly pg_dump → R2 (run via cron)
```

## Prerequisites

- Hetzner CAX11 (Ubuntu 24.04) with SSH key already added, root login working
- DNS A record: `drshoes.forcepush.club` → server IPv4 (Cloudflare, gray cloud)
- Two Cloudflare R2 buckets created in the dashboard:
  - `drshoes-prod`           (zdjęcia zleceń)
  - `drshoes-prod-backups`   (nightly DB dumps)
- R2 API credentials (Object Read & Write on both buckets)
- Misza's Gmail address + 16-char App Password (2FA must be enabled on his Gmail first)

## First-time install

```bash
# 1. As root on the freshly-provisioned box:
git clone https://github.com/AtlasJedi/misza_madafaka.git /opt/drshoes
cd /opt/drshoes
./infra/scripts/install-server.sh

# 2. Switch to deploy user
su - deploy
cd /opt/drshoes

# 3. Configure environment
cp infra/.env.prod.example .env.prod
chmod 600 .env.prod
nano .env.prod   # fill in every [ZMIEŃ]

# 4. Link Caddyfile and reload
sudo ln -sf /opt/drshoes/infra/Caddyfile.prod /etc/caddy/Caddyfile
sudo systemctl reload caddy

# 5. First deploy
./infra/scripts/deploy.sh

# 6. Schedule nightly backups
crontab -e
# Add this line:
#   0 3 * * * /opt/drshoes/infra/scripts/backup-db.sh >> /var/log/drshoes-backup.log 2>&1
sudo touch /var/log/drshoes-backup.log
sudo chown deploy /var/log/drshoes-backup.log

# 7. Verify
curl -I https://drshoes.forcepush.club
# Expect: HTTP/2 200, Server: Caddy, valid LE cert
```

## Redeploy after a code push

```bash
ssh deploy@<server-ip>
cd /opt/drshoes
./infra/scripts/deploy.sh
```

## Viewing logs

```bash
cd /opt/drshoes
docker compose -f infra/docker-compose.prod.yml --env-file .env.prod logs -f backend
docker compose -f infra/docker-compose.prod.yml --env-file .env.prod logs -f web
docker compose -f infra/docker-compose.prod.yml --env-file .env.prod logs -f postgres

# Caddy access log
sudo journalctl -fu caddy
```

## Rollback to a previous commit

```bash
cd /opt/drshoes
git log --oneline -20            # pick the SHA you want
git checkout <sha>
./infra/scripts/deploy.sh
```

**Caution:** Flyway schema migrations are NOT auto-reverted. If the rollback
crosses a migration boundary, restore the DB from the matching R2 backup
first (next section).

## Restore DB from R2 backup

```bash
# List available backups
source /opt/drshoes/.env.prod
aws s3 ls s3://${R2_BUCKET}-backups/db/ --endpoint-url $R2_ENDPOINT

# Restore a specific dump
aws s3 cp s3://${R2_BUCKET}-backups/db/2026-05-21T030000Z.sql.zst - --endpoint-url $R2_ENDPOINT \
  | zstd -d \
  | docker compose -f /opt/drshoes/infra/docker-compose.prod.yml --env-file /opt/drshoes/.env.prod exec -T postgres \
    psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

Test the restore flow ONCE on a throwaway DB before you actually need it.

## Migrate to crm.drshoes.pl

When the registrar for `drshoes.pl` gives DNS access:

1. Add A record at the registrar: `crm.drshoes.pl → <server-IPv4>`
2. Edit `infra/Caddyfile.prod` — uncomment the `crm.drshoes.pl` block (and
   optionally keep the old `drshoes.forcepush.club` block so both URLs work
   in parallel during cutover)
3. Edit `.env.prod` — `APP_HOST=crm.drshoes.pl`
4. `./infra/scripts/deploy.sh` — rebuilds the web image with the new
   `NEXT_PUBLIC_APP_URL` and reloads Caddy
5. Caddy auto-fetches a Let's Encrypt cert for the new host on first request

Active users will need to re-login once (session cookies are domain-bound).
Once nobody's hitting `drshoes.forcepush.club` for a few weeks, drop that block
from the Caddyfile.

## Defense-in-depth backups

Two independent backup paths:

1. **Hetzner Cloud Backups** — enable at server creation (+20% surcharge,
   ~€0.76/mo on a CAX11). Daily snapshots of the whole VM, 7-day rolling.
   Click-to-restore from the Hetzner Console.
2. **R2 nightly DB dumps** — `backup-db.sh` cron, 30-day retention.

If the box dies, restore the Hetzner backup. If only the DB is corrupted,
restore the relevant R2 dump.

## Cost reference (steady state)

| Item | Monthly |
|---|---|
| Hetzner CAX11 | ~€3.79 |
| Hetzner Backups (+20%) | ~€0.76 |
| Cloudflare R2 photos (<10 GB) | $0 (free tier) |
| Cloudflare R2 DB dumps (<1 GB) | $0 (free tier) |
| Cloudflare DNS | $0 |
| **Total** | **~€4.55 (~20 PLN)** |
