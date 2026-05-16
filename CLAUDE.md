<!-- ============================================================ -->
<!-- TOOLING LOCK — read this before invoking ANY subagent or skill -->
<!-- ============================================================ -->
> **THIS PROJECT IS BOUND TO `superpowers` EXCLUSIVELY.**
>
> A `PreToolUse` hook at `.claude/hooks/check-tooling.sh` (wired via
> `.claude/settings.json`) deterministically blocks cross-ecosystem calls.
> If the hook fires, **fix the call site — never loosen the hook.**
>
> **Allowed `Agent.subagent_type`:** `general-purpose`, `Explore`, `Plan`,
> `statusline-setup`, `callitaday`, `claude-code-guide`.
>
> **DENIED:** `forge-*`, `gsd-*`, `gstack-*`, `vercel:*`, `majorfucker`.
> Backend Spring Boot work → dispatch a `general-purpose` Sonnet subagent
> with a thin prompt pointing at the plan file. Do NOT use `forge-backend`
> even though it sounds applicable.
>
> **Allowed `Skill`:** `superpowers:*`, plus harness-internal skills
> (`update-config`, `keybindings-help`, `loop`, `schedule`).
>
> **DENIED skills:** anything matching `gsd-*` / `vercel:*` / `gstack-*`,
> plus gstack-flavored slash commands (`gstack`, `bradlej`, `qa`, `qa-only`,
> `ship`, `dev`, `canary`, `health`, `cso`, `investigate`, `office-hours`,
> `land-and-deploy`, `manifest`, `ports`, `remote`, `checkpoint`, `go`,
> `document-release`, `retro`, `test-loop`, `benchmark`, `debug-e2e`,
> `autoplan`, `design-*`, `plan-design-review`, `plan-ceo-review`,
> `plan-eng-review`, `plan-devex-review`, `devex-review`, `lesson-studio`,
> `setup-deploy`, `setup-browser-cookies`, `open-gstack-browser`,
> `publish_local`).
>
> The full superpowers methodology workflow (brainstorming → writing-plans
> → TDD → subagent-driven-development → requesting-code-review →
> finishing-a-development-branch) is the only sanctioned path.
<!-- ============================================================ -->

# misza_madafaka

Web app project. Design template will be provided by user (Claude design export).

## Tooling

tooling: superpowers

This project is bound to a local clone of [Superpowers](https://github.com/obra/superpowers) at `.superpowers/` (v5.1.0).
Superpowers skills (`superpowers:brainstorming`, `superpowers:writing-plans`,
`superpowers:test-driven-development`, etc.) are the authoritative methodology for this project.

To pin this project to the local clone instead of the globally installed plugin, run once:

```
/plugin marketplace add ./.superpowers
/plugin install superpowers@superpowers-dev
```

To pull updates later:

```
cd .superpowers && git pull
```

## Workflow

Follow Superpowers default workflow for any non-trivial change:
1. `superpowers:brainstorming` — refine intent and design
2. `superpowers:writing-plans` — break work into bite-sized tasks
3. `superpowers:using-git-worktrees` — isolate the workspace
4. `superpowers:subagent-driven-development` or `executing-plans` — implement
5. `superpowers:test-driven-development` — RED-GREEN-REFACTOR throughout
6. `superpowers:requesting-code-review` — review before merge
7. `superpowers:finishing-a-development-branch` — land the work

## Project: Dr Shoes (drshoes.pl)

Two-layer web product for a shoe repair / custom painting workshop in Poland.
Source of truth: `handoff/` (BRIEF, DESIGN_SYSTEM, DATA_MODEL, API_SURFACE, design/).
Locked decisions: `handoff/DECISIONS.md`.
Architecture for sign-off: `ARCHITECTURE.md`.

Admin panel is the priority — public site is minimal-viable.
All UI copy in Polish; code/comments in English.

## Stack

- **Backend:** Java 21 + Spring Boot 3.4, Maven multi-module. Microlibraries under `backend/libs/`: `messaging-core`, `email-gateway`, `sms-gateway`, `storage`.
- **Frontend:** Next.js 16 App Router + TS + Tailwind + Radix. Single app, route groups `(public)` and `(admin)`.
- **DB:** Postgres 16. **Object storage:** Cloudflare R2 (prod) / MinIO (local).
- **Deploy:** Cloudflare Containers (web/api/db) + R2.
- **CI:** GitHub Actions.

## Workflow

Opus drives architecture, planning, review.
Sonnet subagents do mechanical implementation.
Atomic commits, Conventional Commits.
TDD per `superpowers:test-driven-development`.

## Dispatch Protocol (locked 2026-05-08)

**Owner directive: minimize main-session context.** Plans live on disk and are NOT re-pasted into subagent prompts. Subagents read the plan file themselves and write structured dispatch logs to `docs/dispatch-log/`. Main session reads only summary fields. `/clear` must be cheap at any time.

**Rules in force:**
1. Dispatch prompts are THIN — point subagent at `docs/superpowers/plans/<plan>.md` + task id + log template, not full task text.
2. Each dispatch writes `docs/dispatch-log/<task-id>-<UTC>.md` with files, commands, test summary, decisions, commit SHA.
3. Tracker on disk: `docs/dispatch-log/tasks.json` is authoritative across sessions (replaces in-session TaskCreate state for cross-session continuity).
4. **Combined spec+quality review** for pure-config / mechanical TDD tasks. Two-stage only for substantial logic / security-sensitive code / > 100 LOC.
5. Inline trivial fixups (read + edit + commit) — don't dispatch a subagent for 2-line edits.
6. **Granulated code:** Java classes < 120 LOC, TS modules < 80 LOC. Larger units get flagged for split.
7. **Extensive structured logging:** every backend service / controller / aspect logs at INFO with `key=value` fields including correlation/request id, actor, operation, entity id, outcome. Every substantive TS module uses the shared `lib/log.ts` named-logger pattern.
8. Commit messages tag `[milestone:X][task:Y]` and include `Refs: <dispatch-log-path>` in body.
9. If main-session is past ~50% of model window mid-milestone: save state, write a session-summary memory entry, suggest `/clear`. Don't push past 60%.

Full protocol in memory entry `feedback_dispatch_protocol.md` (auto-loaded each session).

## Status

- [x] Project directory created
- [x] Superpowers v5.1.0 cloned to `.superpowers/`
- [x] Handoff package received
- [x] Q&A round complete — `handoff/DECISIONS.md` written
- [x] `ARCHITECTURE.md` drafted and signed off
- [x] Proto API + SQL schema reviewed
- [x] Milestone 0A plan written (`docs/superpowers/plans/2026-05-07-milestone-00a-foundation.md`)
- [x] Milestone 0A: foundation skeleton boots — health green, V001 applied, web renders
- [x] Milestone 0B: auth + RBAC + audit log + login UI + admin guard
- [x] Milestone 1: Order domain + drawer + audit timeline
- [x] Milestone 2: Messaging + triggers
- [x] Milestone 3: Photos + actor resolution (real providers deferred to a later milestone)
- [x] Milestone 4: Real providers + webhooks + delivery reconciliation + retry
- [x] Milestone 5: Inbound parsing + reply UI + cross-client inbox
- [x] Milestone 6: Order processing polish + Dashboard
- [x] Milestone 7: Clients UI + minimal Sklep/Aktualności stubs (implementation closed 2026-05-11 — `milestone-7` tag deferred to owner sign-off)
- [x] Milestone 8: Demo-ready foundation — one-command boot, OTel tracing, Playwright gate, smart-fix scripts (`milestone-8` tag)
- [x] Milestone 9: design parity (admin + landing) — full graffiti design system shipped (closed 2026-05-16 — `milestone-9` tag local, awaiting owner sign-off + push)

## Forward roadmap

`docs/superpowers/ROADMAP.md` is the source of truth for milestone scope after
the BRIEF.md handoff. Locked decisions live there.

**Locked 2026-05-10 by owner:** Sklep + Aktualności become **minimal stubs only**
(`for implementation` placeholders, optionally a read-only shell). Real focus
post-M5 is Dashboard + order-processing polish (M6), then Clients UI + the
stubs (M7). Sklep / Aktualności real implementations have no calendar slot.
