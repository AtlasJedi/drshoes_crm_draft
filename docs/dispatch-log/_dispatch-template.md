# Dispatch Template — Dr Shoes (`misza_madafaka`)

**Use this file as a thin-prompt anchor.** Per-task dispatch prompts should reference
this template by path instead of re-pasting the locked context. Keep per-task
prompts to ~300 tokens (just: task id, plan section + line range, HEAD sha, suite
count, timestamp, review type).

Last updated: 2026-05-10 (after Milestone 6 mid-session bloat audit — owner
mandated 40% main-session cap + subagent slicing on bloat).

---

## 1. Repo + ground truth (read once at dispatch start)

- Repo root: `/Users/atlasjedi/P/misza_madafaka`
- Default branch: `main`
- Bound to **superpowers** only. The PreToolUse hook at `.claude/hooks/check-tooling.sh`
  blocks any cross-ecosystem call.
  - **Allowed `Agent.subagent_type`:** `general-purpose`, `Explore`, `Plan`,
    `statusline-setup`, `callitaday`, `claude-code-guide`.
  - **DENIED:** `forge-*`, `gsd-*`, `gstack-*`, `vercel:*`, `majorfucker`.
  - **Allowed `Skill`:** `superpowers:*`, plus harness-internal (`update-config`,
    `keybindings-help`, `loop`, `schedule`).
- Plan files live under `docs/superpowers/plans/`.
- Per-task dispatch logs live under `docs/dispatch-log/<task-id>-<UTC-ts>.md`.
- Tasks tracker: `docs/dispatch-log/tasks.json` (ground truth across sessions).

## 2. Stack

- **Backend:** Java 21 + Spring Boot 3.4 + Maven multi-module + Flyway + Postgres 16.
  Module-of-record: `backend/apps/admin-monolith` (`app-am`).
- **Frontend:** Next.js 16 App Router + TS + Tailwind + Radix. App at `apps/web/`,
  route groups `(public)` and `(admin)`. **Vitest + Testing Library + jsdom** wired
  as of M6 (commit `edf4258` / `738b548`).
- **Object storage:** Cloudflare R2 (prod) / MinIO (local).
- **Deploy:** Cloudflare Containers + R2.

## 3. Locked backend conventions

1. **Controller package:** `com.drshoes.adminmonolith.api.<feature>` (the `.api.` segment
   is non-negotiable). Reference: `OrderController`, `MessagesController`.
2. **Auth:** session-based (Spring Session JDBC). Admin endpoints use
   `@AuthenticationPrincipal` — must use `authentication()` getter, **not** `user()`
   (locked M5 task 5-9). RBAC via `RbacService` / `@PreAuthorize`.
3. **Audit (locked):**
   - Two-row audit semantics + path-pattern audit.
   - `@Audited(parent="#result.X")` on **record-returning methods** must use
     **no-parens form** (e.g. `#result.threadId`, NOT `#result.threadId()`). Locked M5.
   - `AuditLogAspect` excludes `@ExceptionHandler` methods (locked 0b-8 fixup) — exactly
     one audit row per failed request.
4. **Order operations:** status changes go through `OrderService.changeStatus(...)` —
   that is the locked method name (NOT `updateStatus`). `MessageRouter` post-6-2 split
   handles trigger dispatch via `MessageRecipientResolver`.
5. **Domain:**
   - `OrderItemKind` enum values are **Polish**: `NAPRAWA`, `CUSTOM_BUTY`, `CUSTOM_KURTKA`.
   - `picked_up_at` is the real handover timestamp (locked M2).
   - `OrderStatus` enum is the source of truth for valid transitions.
   - WYDANE / ANULOWANE typically excluded from active boards.
6. **Integration test naming:** **`*IntegrationTest.java` ONLY.** Files named `*IT.java`
   silently never run because Failsafe is in `<pluginManagement>`-only. Critical hygiene
   rule (carry-forward from M3 `PhotoControllerIT` 7-cases-never-executed incident).
7. **Logging:** structured INFO with `key=value` fields including
   correlation/request id, actor (via `AdminPrincipal`), operation, entity id, outcome.
8. **Granularity:** Java classes < 120 LOC where reasonable. Split eagerly (precedent:
   `DashboardChartsController` extracted at 88 LOC to keep `DashboardController` lean).
9. **Migrations:** Flyway in `backend/apps/admin-monolith/src/main/resources/db/migration/`.
   Latest as of HEAD `9e02d14`: **V013** (message_thread uniqueness, 6-3). Next: V014.
10. **Polish locale gotcha (locked 6-5):**
    `NumberFormat.getCurrencyInstance(Locale.forLanguageTag("pl-PL"))` emits U+00A0 (NBSP)
    for thousands and before "zł". Normalize NBSP→space server-side. Reuse
    `DashboardController`'s helper; don't reintroduce the bug.
11. **Jackson default-true booleans (locked 6-9 Stage 2 fixup):**
    `@JsonProperty(defaultValue="true")` is a **no-op for primitive `boolean` in records**
    — it only affects schema generation. Use boxed `Boolean` + compact ctor normalization
    (`if (sendTriggers == null) sendTriggers = Boolean.TRUE;`). At read sites use
    `Boolean.TRUE.equals(req.sendTriggers())`. Add a regression test that POSTs
    **without** the field and asserts the side effect.

## 4. Locked frontend conventions

1. **Server-side fetchers:** `apps/web/lib/<feature>/api-server.ts` modules forward cookies
   from `next/headers`. Reference: `lib/orders/api-server.ts`, `lib/messaging/api-server.ts`,
   `lib/dashboard/api-server.ts` (M6).
2. **Auth gate:** `proxy.ts` (Next 16 — proxy.ts, NOT middleware.ts; locked M0B).
3. **PLN revenue is `string`** (NBSP-normalized server-side). Render directly; don't
   reformat client-side.
4. **Logging:** TS modules use the shared `lib/log.ts` named-logger. No ad-hoc `console.log`.
5. **Granularity:** TS modules < 80 LOC where reasonable. One component per file.
6. **Lint:** `pnpm lint` is `--max-warnings=0` (locked 6-4). New warnings = bug.
7. **Typecheck:** `pnpm typecheck` must stay green.
8. **Vitest:** `pnpm --filter @drshoes/web test` runs the suite. Component tests use
   Testing Library + jsdom env (`vitest.config.ts` + `vitest.setup.ts`).
9. **Visual designs come from the owner via Claude.ai design tool.** Do NOT invent layouts,
   spacing, or colors. If the plan section is silent on visuals, STOP and report.
10. **All UI copy in Polish; code/comments in English.**

## 5. Test commands

- Backend: `./mvnw -pl backend/apps/admin-monolith -am test`
- Frontend typecheck: `pnpm --filter @drshoes/web typecheck`
- Frontend lint: `pnpm --filter @drshoes/web lint`
- Frontend tests: `pnpm --filter @drshoes/web test`
- E2E / smoke (when applicable): per plan section.

## 6. Dispatch log template (REQUIRED for every dispatch)

Path: `docs/dispatch-log/<task-id>-<UTC-timestamp>.md`. UTC timestamp format
`YYYYMMDDTHHMMSSZ` (matches existing logs).

Required sections:
- **Task** — id + title + plan section + line range
- **Files changed** — full path list with one-line description per file. **Include
  the key symbol names with line numbers** (e.g. `OrderRepository.java +42-58:
  added findScheduledInWindow(Instant, Instant)`) so future fixes don't require
  code spelunking.
- **Commands run** — exact commands and pass/fail
- **Test summary** — counts (pass / fail / errors / skipped) before and after
- **Decisions** — non-obvious choices with rationale (constraint names, transaction
  boundaries, locale handling, etc.)
- **Review** — verdict (APPROVED / APPROVED-WITH-FOLLOWUP / NEEDS-FIXUP / TWO-STAGE
  Stage-N) with checklist
- **Commit SHA** — final commit sha after the work lands on `main`
- **Follow-ups** — leftover hygiene items (carry into milestone closure or future)
- **Subagent token budget** — actual `total_tokens` from your run (so the parent can
  audit slice sizing for next time)

After implementation, commit the dispatch log in a separate `chore(dispatch):` commit.

## 7. Tasks tracker update (REQUIRED at dispatch end)

Edit `docs/dispatch-log/tasks.json` to mark the task `completed` with implementation
commit sha + dispatch log path. For TWO-STAGE: track `stage_1_sha` + `stage2_log` or
`fixup_sha` per existing pattern (see `0b-7` and `5-15` entries).

Commit as: `chore(tasks): mark <task-id> done — <verdict> [milestone:<n>][task:<task-id>]`

## 8. Commit message format

```
<type>(<scope>): <subject> [milestone:<n>][task:<task-id>]

<body>

Refs: docs/dispatch-log/<task-id>-<UTC-ts>.md
```

Conventional Commits types. Tracker/dispatch-log commits use `chore` and don't need
bodies, but DO include the `[milestone:<n>][task:<task-id>]` tag.

## 9. Hard constraints

- **Do not push.** Owner pushes manually.
- **If plan contradicts reality** (assumed file/column/method doesn't exist) — STOP,
  do not guess. Report the conflict in your final message and document it under
  "Decisions" or "Follow-ups".
- **Out-of-plan fixes** must be documented under "Decisions" — don't sneak them in.
- **Never invoke a forbidden Skill or subagent type** (see §1).
- **TWO-STAGE tasks:** Stage 1 self-reviews; a fresh independent agent runs Stage 2.
  Do not run both stages from the same agent.

## 10. Token budget rule (locked 2026-05-10 part 8)

- **Subagent target:** stay under ~40% of model window during your run. If you find
  yourself > 50%, STOP and report what subset you completed + what's left. The
  parent will slice the remainder into parallel agents.
- **Report `total_tokens` in your dispatch log** so the parent can audit and slice
  better next time.
- **Reads:** prefer line-anchored Read calls over `cat`-style full-file reads when the
  plan tells you which lines you need.

## 11. Final report back to parent (keep tight)

1. Implementation + dispatch-log + tracker commit shas
2. Suite count before vs after (backend + frontend if both touched)
3. Verdict
4. Subagent `total_tokens` used
5. Follow-ups (one line each)

That's all the parent should need. Keep main-session context light.
