# Deploy Spec — Dr Shoes CRM (Hetzner)

*Written 2026-05-20. Owner: Piotr. Client: Misza.*

## Goal

Get the Dr Shoes admin CRM running on a public URL so Misza can use it daily.
Temporary domain first; migrate to `crm.drshoes.pl` once the old owner gives
us DNS access for `drshoes.pl`.

**Non-goals (for this deploy):**
- Public-facing landing page on `drshoes.pl` (handled separately, later).
- HA / multi-region / autoscaling (single workshop, won't need it).
- Managed Postgres (Postgres runs in compose alongside the app — simplest).

## Stack

- **Host:** Hetzner Cloud, **CAX11** (2 vCPU ARM Ampere / 4 GB RAM / 40 GB NVMe / 20 TB traffic)
- **Region:** Helsinki, FI (lowest latency to PL after Falkenstein, EU = GDPR-clean)
- **OS:** Ubuntu 24.04 LTS
- **Container runtime:** Docker + Docker Compose (existing `docker-compose.yml`)
- **Reverse proxy / TLS:** Caddy v2 (auto Let's Encrypt)
- **Backups:**
  - Hetzner automatic backups (daily, 7-day rolling, +20% = ~€0.76/mo)
  - Nightly `pg_dump` to Cloudflare R2 via cron (defense in depth)
- **Object storage:** Cloudflare R2 (existing — photos, message attachments)
- **Cost forecast:** ~€4.55/month all-in (~20 PLN). First ~4 months free if we land a working referral link.

## Domain plan

### Temporary (week 1 onwards)
- `misza.forcepush.club` → `<Hetzner-IPv4>` (Cloudflare DNS, gray cloud / DNS-only)
- Caddy issues Let's Encrypt cert on first request.

### Permanent (when old owner of `drshoes.pl` gives access)
- Either:
  1. Old owner adds A record: `crm.drshoes.pl → <Hetzner-IP>` (lowest friction), **OR**
  2. Delegate NS for `crm.drshoes.pl` to Cloudflare (medium effort, full control), **OR**
  3. Transfer `drshoes.pl` to Piotr's registrar (~7 days, EPP code needed)

### Migration cost when it happens
~30 minutes:
1. Edit `/etc/caddy/Caddyfile`: swap hostname (or add second hostname for dual-serve)
2. Add A record `crm.drshoes.pl → <IP>` on whoever runs DNS
3. Update env vars: `NEXT_PUBLIC_APP_URL`, `NEXTAUTH_URL`, CORS allowed origins, cookie domain, email sender domain (SPF/DKIM later)
4. `systemctl reload caddy` — auto-fetches new LE cert
5. Active users re-login once (cookies are domain-bound)

Decision: serve both hostnames simultaneously in Caddyfile so the switch is "tell people to use the new URL"; drop the old hostname weeks later.

## Why Hetzner (decision rationale)

Evaluated Cloudflare Containers, Vultr, DigitalOcean.

| | Hetzner | Cloudflare Containers | Vultr | DigitalOcean |
|---|---|---|---|---|
| Comparable 4GB tier | **€3.79/mo** | ~$15–20/mo | $20/mo | $24/mo |
| Postgres support | local container, NVMe | none (must use external) | local | local + managed option |
| MCP for Claude | strong (5+ community, lazyants is best) | partial | community (mcp-vultr, 335 tools) | **official, GA, free** |
| Free credit | €20 via referral (no expiry) | none | $250 / **30-day expiry** | $200 / 60-day expiry |
| EU DC | Falkenstein, Helsinki | edge | Warsaw | Frankfurt, Amsterdam |
| Lock-in | none (plain Linux+Docker) | high | low | low |

**Hetzner wins on price-per-spec (~5× cheaper) with no surprise expiry pressure on the free credit.** Community MCP (`@lazyants/hetzner-mcp-server` v2.0.1, 147 tools across 14 domains) closes the "official MCP" gap. DigitalOcean's first-party MCP is nicer but not worth +$20/mo for a 3-person workshop CRM.

Vultr's $250 credit is a 30-day trial cliff, not a runway — useless for steady-state hosting.

## Currently configured (already done in this session)

- ✅ `~/.claude.json` has `hetzner` MCP entry pointing at `@lazyants/hetzner-mcp-server` with placeholder token `REPLACE_AFTER_HETZNER_SIGNUP`. Backup at `~/.claude.json.bak.20260520-193033`.
- ✅ Cloudflare API token verified (vaulted in `API Keys.md`). Token has zone read access for `forcepush.club` (zone id `a56ca92e70da463946630e0207622603`) and `patiyoga.com`.
- ✅ Confirmed `forcepush.club` zone has **0 DNS records** — apex is empty, no collision risk for `misza.forcepush.club`.
- ✅ Confirmed `forcepush-web` Cloudflare Pages project exists, serving on `forcepush-web.pages.dev` only (not bound to custom domain).

## Blockers — what we're waiting on

1. **Hetzner referral link** (Piotr is sourcing from r/selfhosted / blogs / friend).
   *No referral = forfeit €20. Must use the link before signup.*
2. **Misza Gmail data** (Piotr is on call with Misza now). Need:
   - Gmail address (the `From:` customers will see)
   - 16-char App Password (generated at https://myaccount.google.com/apppasswords)
   - Display name ("Dr Shoes Szczecin" or similar)
   - 2FA must be enabled on his Gmail first
3. **Verbal OK from Misza** that we can send email on his behalf.

## Action sequence (when blockers clear)

```
[Piotr]  Find Hetzner referral link
  → Sign up via the link
  → Verify €20 in Billing → Vouchers
  → Hetzner Console → Security → API Tokens → "Generate API token"
       name: "Claude MCP"
       scope: Read & Write
  → Add SSH public key to Console → Security → SSH Keys
  → Send Claude: API token + email Misza dictated + 16-char app password

[Claude] Vault the Hetzner API token in API Keys.md
  → Vault Misza's app password in API Keys.md (separate section)
  → Swap placeholder in ~/.claude.json with real Hetzner token

[Piotr]  /exit Claude Code, relaunch → MCP loads (147 tools live)

[Claude] Via hetzner MCP:
  → create_server: CAX11, Ubuntu 24.04, location=hel1, ssh_keys=[Piotr's], backups=true
  → return IPv4

[Claude] Via Cloudflare API:
  → create A record: misza.forcepush.club → <IPv4>, proxied=false, TTL=300

[Claude → Piotr]  SSH into server, run one-time hardening:
  - adduser deploy, disable root SSH + password auth
  - ufw allow OpenSSH/80/443
  - apt install docker.io docker-compose-v2 caddy
  - clone misza_madafaka repo to /home/deploy
  - write production .env (DB creds, R2 creds, SPRING_MAIL_USERNAME=misza-gmail, SPRING_MAIL_PASSWORD=app-pw, app URLs)
  - write production Caddyfile (hostname misza.forcepush.club, reverse_proxy api→:8080, web→:3000)
  - docker compose up -d
  - systemctl reload caddy (fetches LE cert)

[Piotr]  Visit https://misza.forcepush.club → log in → smoke test
  → Send Misza the URL + creds + brief usage notes
```

## Pending artifacts to draft (parallelizable while waiting)

These don't need the Hetzner box to exist — I can draft now while Piotr waits on signup/Misza:

- [ ] `infra/Caddyfile.prod` — multi-hostname Caddyfile (misza.forcepush.club today + crm.drshoes.pl ready to go later)
- [ ] `infra/docker-compose.prod.yml` — production override (binds to localhost, no host port exposure, prod DB password from env, restart=always)
- [ ] `infra/.env.prod.example` — env template with all keys called out (DB, R2, SMTP, app URLs, CORS, JWT secret)
- [ ] `infra/scripts/install-server.sh` — one-time host hardening (adduser, ufw, docker, caddy install)
- [ ] `infra/scripts/deploy.sh` — git pull + docker compose build + up -d
- [ ] `infra/scripts/backup-db.sh` — `pg_dump | zstd | aws s3 cp` to R2 (cron: nightly 03:00 UTC)
- [ ] `infra/README.md` — runbook (first-time setup, redeploy, rollback, restore from backup)

Convention: stays at `infra/` at the repo root (separate from `app/` and `web/` source).

## Cost forecast

| Item | First 4 months | Month 5+ |
|---|---|---|
| Hetzner CAX11 | covered by €20 referral | €3.79/mo |
| Hetzner Backups | covered | €0.76/mo |
| Cloudflare R2 photos | $0 (well under 10 GB free) | ~$0 |
| Cloudflare R2 DB backups | $0 | ~$0 (a few MB/night) |
| DNS (Cloudflare) | $0 | $0 |
| Domain (`drshoes.pl`) | $0 (already paid for full year) | renewed by Piotr separately |
| **Total** | **€0** | **~€4.55/mo (~20 PLN)** |

## Open questions

1. Subdomain spelling: `misza.forcepush.club` or `drshoes.forcepush.club` or `crm.forcepush.club`? `misza` is most personal but a customer might see the URL if linked from emails. **Recommendation:** `drshoes.forcepush.club` — reads cleaner during the temp window.
2. Should the temp URL be hidden from search engines? (Add `<meta name="robots" content="noindex">` and `X-Robots-Tag` in Caddy for the temp hostname.) **Recommendation:** yes — workshop URL leaking into Google before the real launch would be noise.
3. Hetzner backups: enable at server creation or skip and rely only on R2 dumps? **Recommendation:** enable (it's €0.76/mo and gives point-in-time recovery of the whole box, not just the DB).
4. Email sender: Gmail SMTP through Misza's account is fine for dev / low volume. **Open:** at scale, swap to Resend with a `noreply@drshoes.pl` sender + SPF/DKIM/DMARC. Not now.

## What this spec does NOT cover

- Public landing page redesign on `drshoes.pl` (separate work, after admin CRM is live)
- SPF/DKIM/DMARC for `drshoes.pl` (requires old owner DNS access)
- SMS provider integration (M4 messaging — covered in milestone spec, not deploy)
- Real production observability (OTel collector + downstream — currently exports to local Jaeger only)
- HA, failover, multi-region — not needed for this workload

---

*This spec captures the full conversation from 2026-05-20. Resume from "Blockers" when Piotr returns with Hetzner token + Misza's Gmail data.*
