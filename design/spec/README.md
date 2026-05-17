# Dr Shoes — Developer Handoff Package

Hand this whole folder to Claude Code as the brief.

## Start here
**`CLAUDE_PROMPT.md`** — paste this into Claude Code as your opening message.

## Files
- `CLAUDE_PROMPT.md` — instructions for Claude (use Opus, ask follow-ups first, stack constraints, deliverables).
- `BRIEF.md` — canonical functional spec. Every screen and behavior.
- `DESIGN_SYSTEM.md` — colors, typography, components, motion.
- `DATA_MODEL.md` — entities, fields, enums, indexes.
- `API_SURFACE.md` — REST endpoints starting point.
- `QUESTIONS.md` — questions Claude must answer before writing code.
- `design/` — the hi-fi HTML/JSX prototype. Open `Dr Shoes Site + CRM.html` in a browser. The toggle in the top bar flips between public landing and admin CRM.

## Stack (fixed)
- **Backend:** Java + Spring Boot, PostgreSQL, Flyway, S3-compatible storage (MinIO local).
- **Frontend:** Claude recommends in their first reply (Next.js or Astro+Vite/React). User confirms.
- **Local dev:** Docker Compose.

## What Claude will do
1. Read everything.
2. Send one consolidated follow-up message with all questions.
3. Wait for answers.
4. Produce `ARCHITECTURE.md` for sign-off.
5. Build the repo.
