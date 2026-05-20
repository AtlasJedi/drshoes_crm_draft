# Dr Shoes

Two-layer web CRM for a shoe repair and custom painting workshop in Poland. Consists of a public-facing landing page and a full admin panel for managing orders, clients, messaging, triggers, and photos — all UI copy in Polish, code and comments in English.

> **Klient warsztatu instalujący aplikację u siebie?** → Otwórz **[HANDOFF.md](HANDOFF.md)** — pełna instrukcja krok po kroku po polsku.

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Docker Engine | ≥ 24 | runtime for all containers |
| Docker Compose plugin | ≥ 2.20 | `docker compose up` orchestration |
| RAM | ≥ 4 GB | Postgres + Spring Boot + Next.js + Jaeger running simultaneously |
| Free disk | ≥ 10 GB | images + DB volumes + order photos (MinIO) |
| Open ports | 3000, 8080 | 5432 is local-only unless you expose it |

**No Java or Node.js needed on client machines** — everything runs inside containers. Java 21, Node 20, and pnpm 9 are only needed when building from source in a development environment.

First `make demo` downloads ~1.5 GB of images; subsequent runs start in seconds from the local cache.

## Quick install (client / production)

```bash
# 1. Clone the repo
git clone https://github.com/AtlasJedi/misza_madafaka.git
cd misza_madafaka

# 2. Configure environment
cp .env.example .env
nano .env   # fill in required secrets — see DEPLOYMENT.md for full reference

# 3. Boot everything and seed sample data
make demo
```

When the stack is ready, `make demo` prints:

```
✅ Dr Shoes demo gotowy
   Admin URL:  http://localhost:3000/admin/login
   Login:      misza@drshoes.pl
   Hasło:      change-me-on-first-login
   Jaeger UI:  http://localhost:16686
   MinIO:      http://localhost:9001  (drshoes / drshoes-dev-secret)
```

Running `make demo` a second time is safe — the seed runner detects existing data and skips automatically.

See [DEPLOYMENT.md](DEPLOYMENT.md) for the complete environment variable reference, email setup (Gmail vs custom domain), first-login admin creation, and backup/restore instructions.

## Developer quick start

```bash
make up        # build images and boot full stack (postgres + minio + backend + web)
make test      # full backend (Maven verify) + frontend (vitest) test suite
make down      # stop all containers
make clean     # stop and delete volumes (wipes database and object storage)
make logs      # tail all container logs
```

After `make up`, services are available at:

| Service | URL |
|---|---|
| Public site | http://localhost:3000 |
| Admin panel | http://localhost:3000/admin |
| Backend API | http://localhost:8080 |
| Health check | http://localhost:8080/actuator/health |
| MinIO console | http://localhost:9001 (drshoes / drshoes-dev-secret) |
| Jaeger tracing | http://localhost:16686 |

## Environment variables

Copy `.env.example` to `.env` before the first boot. The most important categories:

- **Database credentials** — `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- **Object storage** — `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD` (MinIO for local dev; swap for Cloudflare R2 credentials in production)
- **JWT secret** — generated in `.env.example`, rotate before production
- **Email / SMTP** — `SPRING_MAIL_HOST`, `SPRING_MAIL_USERNAME`, `SPRING_MAIL_PASSWORD` (optional for local dev; required in production)
- **SMS** — `MESSAGING_SMS_PROVIDER` (optional; backend has the sms-gateway microlib wired, provider config needed separately)
- **Demo seed** — `DRSHOES_DEMO_SEED_ENABLED=false` must be set in production

See [DEPLOYMENT.md](DEPLOYMENT.md) for the complete variable list, Gmail vs Resend email setup walkthrough, and a production-ready checklist.

## Architecture overview

The backend is a Maven multi-module Spring Boot 3.4 application on Java 21, exposing a REST API consumed by a Next.js 16 App Router frontend. All state lives in PostgreSQL 16 with Flyway managing schema migrations. Photo storage uses MinIO locally and Cloudflare R2 in production. OpenTelemetry traces are collected and viewed in Jaeger.

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS, Radix UI |
| Backend | Java 21, Spring Boot 3.4, Maven multi-module |
| Database | PostgreSQL 16, Flyway migrations |
| Object storage | MinIO (dev) / Cloudflare R2 (prod) |
| Observability | OpenTelemetry, Jaeger |

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full design document covering module structure, data model, auth/RBAC, messaging pipeline, and deployment topology.

## Project layout

```
backend/          Spring Boot multi-module (app + messaging-core + email-gateway + sms-gateway + storage)
apps/web/         Next.js 16 — (public) landing + (admin) CRM route groups
packages/ui/      Shared design tokens, Tailwind preset, Radix components
packages/api-types/  TypeScript types
docs/             Schema, API contract, plans, dispatch logs
design/spec/      Original brief, locked decisions, data model, API surface, design system
design/prototype/ Canonical visual prototype (HTML + JSX + CSS)
design/archive/   Past per-milestone design exports
infra/            Deploy manifests (Cloudflare Containers, GitHub Actions)
```

## Troubleshooting

**Port conflict on 5432** — If Postgres is already running locally, override the port:

```bash
POSTGRES_PORT=5433 make demo
```

**M2 / Apple Silicon** — All images in `docker-compose.yml` are published as multi-arch manifests. No `--platform` flag is needed. If Docker reports `no matching manifest`, update Docker Desktop to ≥ 4.20.

**Backend slow to start** — `make demo` waits indefinitely for the health endpoint. If the backend never becomes healthy, check for Flyway migration failures:

```bash
make logs
# or just the backend
docker compose logs backend | grep -i "flyway\|migration\|error"
```
