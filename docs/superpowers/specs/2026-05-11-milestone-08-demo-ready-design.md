# Milestone 8 — Demo-Ready Foundation

**Status:** spec
**Date:** 2026-05-11
**Owner directive:** "I want working demo asap, I'll test it myself locally, then come back to discuss fixes. Since it's a big project I expect multiple fuckups. We need a smart way of fixing elements — if we have to scan big chunks of code for each small change, we will be fucked. We need extensive observability. OpenTelemetry would be amazing."

## Goal

Stand up a working local demo of the entire admin order-processing flow so the owner can dogfood it. Make subsequent bug-fix cycles cheap by emitting full end-to-end traces (browser → Next.js → Spring Boot → DB / outbound) into a local Jaeger and by giving the owner a one-click "Report issue" primitive that hands Claude a trace id + URL + user — so the fix path becomes "open trace, read 3-5 files" instead of "scan the codebase".

Provider integrations stay **mocked** for demo purposes (Postmark + SmsApi already have logging fallbacks; WhatsApp gets a brand-new logging gateway). All mocked providers print a structured `op=gateway.dispatch.<channel> outcome=mocked` line so we can verify the trigger fired.

## Non-goals

- Real Postmark / SmsApi / WhatsApp Business API integration. The wiring is already there for email + SMS; flipping `messaging.email.provider=postmark` is out of scope for this milestone.
- Production deployment to Cloudflare Containers.
- Production sampling tuning or remote observability backend.
- Auto-capture of console errors, network requests, screenshots, or DOM snapshots inside the bug-report payload. (Trace id + URL + user is enough; we keep the primitive lean.)
- Hygiene carry-forward items from prior milestones unless they sit on the file path being touched.
- Public landing page or Sklep/Aktualności real implementation (still deferred per ROADMAP).

## What "demo-ready" means

1. `make demo` on the owner's macOS spins the full stack (Postgres + MinIO + Jaeger + backend + frontend), runs Flyway, optionally seeds sample data, prints **the admin URL, the admin credentials, and the Jaeger URL** in a single banner.
2. Logging in as `misza@drshoes.pl` lands on `/admin/dashboard`.
3. From the dashboard, the owner can: create a new order, advance it through the status pipeline, mark it delivered, and see the timeline reflect every step. Each status transition that has a messaging trigger fires the matching template; the mocked provider logs `op=gateway.dispatch.email outcome=mocked recipient=... template=...`.
4. WhatsApp triggers — currently broken because `MessageGatewayDispatcher` throws on `WHATSAPP` — work end-to-end through the new `LoggingWhatsAppGateway`.
5. Every user action emits a single trace visible in Jaeger at `localhost:16686`, spanning browser → web → api → DB → outbound provider mock.
6. The admin sidebar has a "Zgłoś problem" button that opens a modal showing the current trace id, current URL, and current user. A "Copy as JSON" action copies a structured payload ready to paste into a chat with Claude.
7. A Playwright E2E spec exercises the full new-order → process → deliver flow and asserts the trace exists. It must pass before this milestone is closed; the main session runs it in a fix-loop until green.

## Architecture

### Trace flow

```
Browser ──fetch + traceparent──▶ Next.js ──fetch + traceparent──▶ Spring Boot
   │                              │                                 │
   │                              │                                 ├──▶ Postgres   (JDBC autoinstr)
   │                              │                                 ├──▶ MinIO/R2   (manual span)
   │                              │                                 ├──▶ Email/SMS/WA gateway (manual span)
   │                              │                                 └──▶ Audit log write (span event + trace_id column)
   │                              │
   │                              ├──OTLP/HTTP──▶ Jaeger :4318
   │                              │
   └──OTLP/HTTP via /api/otlp──▶ Jaeger :4318   (Next route proxy to avoid browser-side CORS)
```

Sampling = **1.0** in dev. Single trace per user-initiated action is the goal.

### Components introduced

| Component | Where | Purpose |
|---|---|---|
| `whatsapp-gateway` Maven module | `backend/libs/whatsapp-gateway/` | Mirror of `sms-gateway`: `WhatsAppGateway` interface, `LoggingWhatsAppGateway` default impl, `WhatsAppGatewayAutoConfiguration` with `@ConditionalOnMissingBean` fallback. No real provider impl this milestone. |
| `MessageGatewayDispatcher` patch | `backend/app/.../MessageGatewayDispatcher.java` | Add `WhatsAppGateway` constructor dep + `case WHATSAPP -> whatsAppGateway.send(outbound);` to the switch. |
| Backend OTel deps | `backend/app/pom.xml` | `io.opentelemetry.instrumentation:opentelemetry-spring-boot-starter` (auto-instruments controllers + JDBC + RestClient). Configured by `application.yaml` to export OTLP/HTTP to `http://jaeger:4318`. |
| Backend manual spans | `MessageGatewayDispatcher.dispatch`, `AuditLogAspect`, optionally `StorageService` upload/get | Named spans with semantic attributes: `messaging.channel`, `messaging.template`, `audit.operation`, etc. Recipient is hashed (SHA-256 prefix) — never raw. |
| `audit_log.trace_id` column | V014 migration | `varchar(32) NULL`. Populated by `AuditLogAspect` from `Span.current().getSpanContext().getTraceId()`. |
| Frontend OTel — server | `apps/web/instrumentation.ts` | Next.js `register()` hook, `@opentelemetry/sdk-node` + OTLP exporter to `http://jaeger:4318`. Auto-instruments server-side `fetch` and Next route handlers. |
| Frontend OTel — browser | `apps/web/lib/otel/browser-client.ts` | `@opentelemetry/sdk-trace-web` + `XMLHttpRequest`/`fetch` instrumentation. Exports OTLP via `/api/otlp` Next route handler (proxies to Jaeger so the browser doesn't hit CORS). |
| `apps/web/app/api/otlp/route.ts` | Next route | POST proxy that forwards OTLP body to `http://jaeger:4318/v1/traces`. Validates content-type. |
| Bug-report button | `apps/web/app/(admin)/_components/ReportIssueButton.tsx` | Sidebar nav entry "Zgłoś problem". Reads current trace id from active span via `trace.getActiveSpan()`, current pathname, current user email. Modal with a "Kopiuj JSON" button. |
| `docs/MODULE_MAP.md` | doc | Table: feature/route → backend service → key files. Backup index when no trace id is available. |
| `tools/where-is` | shell script | `./tools/where-is order-drawer` → parses MODULE_MAP.md, prints file paths. |
| Jaeger service | `docker-compose.yml` | `jaegertracing/all-in-one:1.62`, ports `4318` (OTLP-HTTP) + `16686` (UI). |
| `make demo` | `Makefile` | `up-deps` → wait for postgres-healthy + minio-healthy → `up` → wait for backend-healthy + web reachable → optional seed → print banner. |
| Dev seed runner | `backend/app/.../demo/DemoSeedRunner.java` | `@Component @Profile("local") @ConditionalOnProperty("drshoes.demo.seed.enabled")` ApplicationRunner. Idempotent insert of ~6 clients + ~12 orders spread across statuses + a few photos + a sample message thread. Skips if `client` table already has ≥6 rows. |
| Playwright suite | `apps/web/e2e/demo-flow.spec.ts` | Headless Chromium. Login → create order → advance status → mark delivered → assert audit timeline + assert Jaeger has a trace for the session. |

### Configuration keys

```yaml
# application.yaml
otel:
  sdk:
    disabled: false
  exporter:
    otlp:
      endpoint: ${OTEL_EXPORTER_OTLP_ENDPOINT:http://localhost:4318}
      protocol: http/protobuf
  resource:
    attributes:
      service.name: drshoes-app
      service.namespace: drshoes
      deployment.environment: ${DEPLOYMENT_ENV:local}
  traces:
    sampler: always_on

drshoes:
  demo:
    seed:
      enabled: ${DRSHOES_DEMO_SEED_ENABLED:false}
```

`application-local.yaml` flips `drshoes.demo.seed.enabled=true` and points `OTEL_EXPORTER_OTLP_ENDPOINT` at the in-compose `http://jaeger:4318`.

```yaml
# .env.example (frontend, root)
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
NEXT_PUBLIC_OTLP_ENDPOINT=/api/otlp
NEXT_PUBLIC_OTEL_SERVICE_NAME=drshoes-web
```

### Bug-report JSON shape

Owner clicks "Zgłoś problem" → modal opens → clicks "Kopiuj JSON". Clipboard receives:

```json
{
  "traceId": "4bf92f3577b34da6a3ce929d0e0e4736",
  "url": "/admin/orders/abc-123",
  "user": "misza@drshoes.pl",
  "userAgent": "Mozilla/5.0 ...",
  "capturedAt": "2026-05-11T18:42:00.000Z",
  "jaegerUrl": "http://localhost:16686/trace/4bf92f3577b34da6a3ce929d0e0e4736"
}
```

Owner pastes this verbatim into the chat. Claude reads `MODULE_MAP.md` keyed by URL pattern, opens Jaeger via the trace id, narrows to 3-5 files, fixes.

### MODULE_MAP.md shape

Markdown table. One row per feature/route. Columns: feature name, URL pattern, primary frontend files, primary backend files, primary tests.

Example row:

| Feature | URL | Frontend | Backend | Tests |
|---|---|---|---|---|
| Order drawer | `/admin/orders/:id` | `apps/web/app/(admin)/admin/orders/[id]/page.tsx`, `apps/web/app/(admin)/admin/orders/_components/OrderDrawer*.tsx` | `OrderController`, `OrderService`, `OrderRepository` | `OrderControllerIntegrationTest`, `OrderDrawer.test.tsx` |

`tools/where-is order-drawer` grep-matches the feature column and prints the rest.

## Out-of-scope but adjacent — hygiene we absorb only if touched

- AuditLogAspect already gets touched (trace_id column write) — fix the test flake while we're in there.
- `MessageGatewayDispatcher` gets touched (WhatsApp case) — no need to re-split.
- Other carry-forward items (vitest mock warning, vite-tsconfig-paths plugin, RodoInline placeholder, listOrdersServer duplication, countByClientId discard filter, send/sendRetry dedup) are NOT in scope and stay on the post-M8 hygiene list.

## Acceptance criteria

The milestone is complete when ALL of the following hold:

1. `make demo` from a clean checkout finishes ≤ 90 s, prints a banner with admin URL + email + password + Jaeger URL, exits 0.
2. `make demo` is idempotent — running it twice doesn't double-seed.
3. Backend tests: `mvn verify` green (existing 368 + new tests for WhatsApp gateway lib + manual-span emission unit tests + dev-seed-runner unit test).
4. Frontend tests: `pnpm -r test` green (existing 172 + new bug-report-button vitest + instrumentation init unit test).
5. Logging in as `misza@drshoes.pl / change-me-on-first-login` lands on `/admin/dashboard` with ≥3 sample clients and ≥6 sample orders visible.
6. Creating a new order, advancing it through PRZYJETE → W_REALIZACJI → GOTOWE → ODEBRANE, and triggering its status messages results in:
   - audit_log rows for every transition with a non-null `trace_id`,
   - log lines `op=gateway.dispatch.{email|sms|whatsapp} outcome=mocked ...` for every trigger fire,
   - one Jaeger trace per click that spans browser → web → api → DB → gateway-mock.
7. A WhatsApp-channel trigger does NOT throw (was broken before this milestone).
8. The Playwright spec `demo-flow.spec.ts` passes from a clean `make demo` boot.
9. Clicking the sidebar "Zgłoś problem" button, then "Kopiuj JSON", places a valid bug-report JSON on the clipboard with a real trace id (not all zeros).
10. `docs/MODULE_MAP.md` covers at minimum: orders list/drawer/create, clients list/detail/edit, dashboard, messages thread/inbox, auth/login, photos upload.
11. `tools/where-is order-drawer` prints at least 3 file paths.
12. The main session has run the Playwright spec, captured failures, and iterated fixes to green BEFORE handing the demo URL + creds back to the owner.

## Risks and design decisions

- **OTel starter version drift.** Spring Boot 3.4 + the OTel Spring Boot starter has had churn. We pin to `opentelemetry-spring-boot-starter:2.x` known-compatible with Boot 3.4. If unavoidable issues surface, fallback is the OTel Java agent attached at startup via `-javaagent` — keeps the code untouched but adds Docker friction. Decision: try the starter first, fall back to agent only if needed.
- **Browser → Jaeger via Next proxy** trades a tiny perf hit for skipping CORS config on Jaeger. Worth it for demo simplicity.
- **Seed via ApplicationRunner not Flyway.** Flyway seeds would muddy prod migrations. ApplicationRunner gated by `@Profile("local")` + property flag is safer and keeps real migrations clean.
- **WhatsApp gateway is mock-only.** Real WhatsApp Business Cloud API integration deferred. The interface is shaped to match `EmailGateway` / `SmsGateway` so a real impl can slot in without changes elsewhere.
- **Playwright in-repo or separate package?** In-repo at `apps/web/e2e/` keeps the deps colocated and avoids a new workspace. Decision: in-repo.

## Implementation order (high-level — plan will refine)

- **Wave 1 — Backend foundations.** WhatsApp gateway lib, dispatcher wiring, V014 audit_log.trace_id, backend OTel deps, application.yaml OTel config.
- **Wave 2 — Backend instrumentation.** Manual spans on dispatcher + audit aspect + storage. Audit aspect writes trace_id. Unit tests assert span emission.
- **Wave 3 — Dev seed.** DemoSeedRunner + sample data covering all order statuses + at least one thread.
- **Wave 4 — Compose + boot.** Jaeger service, `make demo` target, banner output, README section, .env.example.
- **Wave 5 — Frontend instrumentation.** `instrumentation.ts`, browser client, /api/otlp proxy, traceparent propagation verified.
- **Wave 6 — Smart-fix layer.** MODULE_MAP.md, tools/where-is script, "Zgłoś problem" button + modal + clipboard.
- **Wave 7 — End-to-end verification.** Playwright suite, run in fix-loop until green, then close milestone and hand demo URL + creds to owner.

## Out of scope — explicit deferrals

- Postmark / SmsApi / real WhatsApp providers — env wiring exists; switching them on is owner's call later.
- Cloudflare Containers deploy.
- Production-tier sampling and observability backend (Tempo / Honeycomb / etc).
- Auto-capture of console + network + screenshot inside the bug-report.
- Public site / Sklep / Aktualności real impl.
