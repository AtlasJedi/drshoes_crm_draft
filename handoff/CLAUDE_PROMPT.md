# Prompt for Claude Code — Dr Shoes (drshoes.pl) Web Product

> **Copy this entire file into Claude Code as your opening message. Attach the rest of the `handoff/` folder contents alongside it.**

---

## Who you are and what you're building

You are an expert full-stack engineer + product designer. You're going to build a **two-layer web product** for **Dr Shoes** — a shoe repair, custom shoe painting, and custom jacket painting workshop based in Poland (drshoes.pl, @dr_shoes on Instagram).

The product has two layers:

1. **Public landing page** — single long-scroll marketing site with shop reservations and contact intake.
2. **Admin CRM** at `/admin` — manages the lifecycle of every order (drop-off → in progress → ready → handed over), photo galleries, internal notes, unified client messaging across email/SMS, automated trigger messages, shop CRUD, news CRUD, dashboards.

A high-fidelity HTML/JSX design prototype is included in `design/` (`Dr Shoes Site + CRM.html` is the entry point). Use it as the **visual + structural source of truth** for layouts, components, color tokens, copy, and Polish microcopy. Do not invent new flows or rename screens — match what's in the prototype.

## How to work — non-negotiable

- **Use Claude Opus for all design and architecture decisions.** When you reason about schema, API shape, component boundaries, state strategy, deployment topology, or any non-trivial design judgment, switch to/stay on Opus. Use lighter models only for mechanical edits.
- **Do not start coding until you've asked the user follow-up questions and gotten answers.** A starter list of questions is in `QUESTIONS.md` — go through it, add your own, send them as a single batched message, then wait.
- **Stack is fixed:**
  - Backend: **Java + Spring Boot** (Spring Web, Spring Data JPA, Spring Security, Flyway for migrations, Bean Validation). Maven or Gradle — your call, but justify briefly.
  - Frontend: **pick the best fit for the design** and justify it in your follow-up. The design is highly graphical (graffiti aesthetic on the landing, dense data-driven views on the admin) — recommended candidates are **Next.js (App Router) + React + TypeScript + Tailwind**, or **Astro + React islands** for the marketing layer plus a **Vite + React + TS** SPA for the admin. Recommend one, explain trade-offs, let the user confirm.
  - DB: **PostgreSQL**. Object storage: **S3-compatible** (MinIO for local dev). Email: **SMTP via Spring Mail** with provider-agnostic config. SMS: **Twilio** abstraction (interface + dev/no-op impl).
- **Two repos or monorepo?** Recommend a monorepo (`/backend`, `/frontend-public`, `/frontend-admin`, `/infra`) and justify.
- **All UI copy and labels are in Polish.** The design files are the canonical source — copy verbatim. Code identifiers, comments, and commits stay in English.
- **Do not recreate any branded UI from third-party products.** The graffiti/street aesthetic is original to this project.

## Deliverables

1. A single follow-up message with **all your clarifying questions** (combine `QUESTIONS.md` + anything else you need). Wait for answers.
2. A **technical design doc** (`ARCHITECTURE.md`) covering: chosen frontend, module boundaries, data model (ERD), API surface (REST endpoints with request/response shapes), auth model, file upload flow, messaging architecture, trigger engine design, deployment plan. Get user sign-off before coding.
3. A **working repo** with:
   - Backend: domain models, JPA entities + Flyway migrations, REST controllers, service layer, security config, integration tests for critical paths.
   - Frontend(s): all screens shown in the prototype, wired to the backend, responsive desktop + mobile for landing, desktop-first admin (mobile usable but not optimized).
   - Docker Compose for local dev (Postgres + MinIO + backend + frontend(s)).
   - Seed script with realistic Polish sample data.
   - README per package + a top-level README explaining how to run everything.
4. A short **DEMO.md** with a click-through script that exercises every major flow.

## Source material

- `BRIEF.md` — original product brief (the canonical functional spec).
- `DESIGN_SYSTEM.md` — color tokens, typography, component patterns extracted from the prototype.
- `DATA_MODEL.md` — starting point for entities and relationships. Refine in your `ARCHITECTURE.md`.
- `API_SURFACE.md` — starting point for REST endpoints. Refine in your `ARCHITECTURE.md`.
- `QUESTIONS.md` — questions to ask the user before you start.
- `design/` — the HTML/JSX prototype. Open `Dr Shoes Site + CRM.html` in a browser to interact with it. The toggle in the top bar flips between the public landing and the admin CRM.

## Process expectations

- Small, well-named commits. Conventional commits (`feat:`, `fix:`, `refactor:`, etc).
- Treat the prototype as a contract. If you must deviate, flag it and ask first.
- Don't over-engineer. No microservices, no event sourcing, no GraphQL unless the user explicitly asks. Boring Spring Boot monolith + a clean REST API + a typed frontend.
- Tests: integration tests for backend endpoints (Spring Boot Test + Testcontainers for Postgres), unit tests for trigger engine and any non-trivial service logic. Frontend: smoke tests for critical flows (Playwright recommended).

## First action

**Read every file in this handoff package, then send the user one consolidated message with all your follow-up questions. Do not write any code yet.**
