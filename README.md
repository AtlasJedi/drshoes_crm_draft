# Dr Shoes

Two-layer web product (public landing + admin CRM) for Dr Shoes — shoe repair, custom painting, custom jacket painting workshop in Poland.

See `ARCHITECTURE.md` for the full design. UI strings are Polish; code/comments are English.

## Quick start

Prereqs: Docker, Java 21, Node 20+, pnpm 9, Maven 3.9.

```sh
make up        # boots postgres + minio + backend + web
make test      # runs full backend + frontend test suite
make down      # stops everything
```

After `make up`:
- Public site:  http://localhost:3000
- Admin shell:  http://localhost:3000/admin
- Backend API:  http://localhost:8080
- Health:       http://localhost:8080/actuator/health
- MinIO console: http://localhost:9001 (drshoes / drshoes-dev-secret)

## Run the demo

One command boots the full stack (Postgres, MinIO, Jaeger, backend, frontend) and seeds sample data:

```sh
make demo
```

When ready, the banner prints:

```
✅ Dr Shoes demo gotowy
   Admin URL:  http://localhost:3000/admin/login
   Login:      misza@drshoes.pl
   Hasło:      change-me-on-first-login
   Jaeger UI:  http://localhost:16686
   MinIO:      http://localhost:9001  (drshoes / drshoes-dev-secret)
```

Running `make demo` a second time is safe — the seed runner skips automatically when sample data is already present.

### Troubleshooting

**Postgres port conflict** — If port `5432` is already in use, override it:

```sh
POSTGRES_PORT=5433 make demo
```

**M2 / Apple Silicon** — All images in `docker-compose.yml` are published as multi-arch manifests (`postgres:16-alpine`, `minio/minio:RELEASE.2024-10-13T13-34-11Z`, `jaegertracing/all-in-one:1.62`). No `--platform` flag should be required. If Docker reports `no matching manifest`, ensure Docker Desktop is updated to ≥ 4.20.

**Backend takes > 60 s to start** — The `until curl` loop in `make demo` waits indefinitely. If the backend never becomes healthy, check logs with `make logs` and look for Flyway migration failures.

## Layout

- `backend/` — Spring Boot multi-module Maven project (`app` + four reusable libs).
- `apps/web/` — Next.js 16 (public landing + `/admin/*` route group).
- `packages/ui` — shared design tokens + Tailwind preset.
- `packages/api-types` — TypeScript types generated from backend OpenAPI.
- `docs/` — schema, API contract, plans.
- `handoff/` — original brief, design prototype, locked decisions.
- `infra/` — deploy manifests (Cloudflare Containers, GitHub Actions) — added in a later milestone.
