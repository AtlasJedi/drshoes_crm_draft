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

Opus 4.7 (this session) drives architecture, planning, review.
Sonnet subagents do mechanical implementation.
Atomic commits, Conventional Commits.
TDD per `superpowers:test-driven-development`.

## Status

- [x] Project directory created
- [x] Superpowers v5.1.0 cloned to `.superpowers/`
- [x] Handoff package received
- [x] Q&A round complete — `handoff/DECISIONS.md` written
- [x] `ARCHITECTURE.md` drafted and signed off
- [x] Proto API + SQL schema reviewed
- [x] Milestone 0A plan written (`docs/superpowers/plans/2026-05-07-milestone-00a-foundation.md`)
- [x] Milestone 0A: foundation skeleton boots — health green, V001 applied, web renders
- [ ] Milestone 0B plan: auth + RBAC + RbacService
- [ ] Milestone 1: Order domain + drawer + audit timeline
