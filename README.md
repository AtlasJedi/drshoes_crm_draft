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

## Layout

- `backend/` — Spring Boot multi-module Maven project (`app` + four reusable libs).
- `apps/web/` — Next.js 16 (public landing + `/admin/*` route group).
- `packages/ui` — shared design tokens + Tailwind preset.
- `packages/api-types` — TypeScript types generated from backend OpenAPI.
- `docs/` — schema, API contract, plans.
- `handoff/` — original brief, design prototype, locked decisions.
- `infra/` — deploy manifests (Cloudflare Containers, GitHub Actions) — added in a later milestone.
