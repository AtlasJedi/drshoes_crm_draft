# Questions to ask the user before coding

Send these as a single batched message. Add anything else you need. **Do not start coding until you have answers.**

## Scope & priorities
1. **MVP cutline** — which sections must ship first? (Suggest order: backend skeleton → public landing → orders list+drawer → kanban → messaging → triggers → calendar → dashboard. Confirm or reorder.)
2. **Hard deadline** or open-ended?
3. **Single user (the owner) or a team** using the admin from day one? How many craftsmen? Different permission levels needed?
4. **Languages** — Polish only at launch, or also English / German for tourist customers?

## Hosting & ops
5. Where will this be hosted? (VPS, Hetzner, AWS, Railway, Fly, on-prem?) Anything already in place?
6. Domain confirmed (`drshoes.pl`)? Should `/admin` be on the same domain or a subdomain (`admin.drshoes.pl`)?
7. Backup / DR expectations? (daily Postgres dump to object storage is the default — confirm)
8. CI/CD preference (GitHub Actions / GitLab CI / none — manual deploys)?

## Integrations
9. **Email provider** — SMTP via existing host, or a transactional service (Postmark, Resend, Mailgun, SendGrid)? Sender domain ready for SPF/DKIM?
10. **SMS provider** — Twilio is the default abstraction. Polish-friendly alternatives (SMSAPI.pl, Vonage) — preference?
11. **WhatsApp** — listed in the brief but real WA Business API requires Meta approval and sender numbers. Defer to phase 2 with a stub interface, or block on this?
12. **Object storage** — S3, Cloudflare R2, MinIO self-hosted, Hetzner Object Storage? Local dev = MinIO regardless.
13. **Maps** — Google Maps embed (free iframe) is fine for the contact section. Or prefer OpenStreetMap / Mapbox?
14. **Analytics** — Plausible / Umami / GA4 / none?
15. **Payments** — brief says reservation only, no payment. Confirming we do **not** integrate any payment processor?

## Business logic
16. Reservation TTL is 48h per the brief. After 48h: auto-expire to `available`, or send a manual reminder to the admin? Confirm.
17. Order code format — preference? (Default suggestion: `DR-2025-0042`, year-resetting sequence.)
18. "Wydane" → can a wydane order be reopened/edited? (Default: read-only after handover, except for adding photos and notes.)
19. Multiple craftsmen on one order, or one assignee max? (Default: one assignee, mention others in notes.)
20. Order types in the brief are **naprawa / custom buty / custom kurtka**. Anything else? (E.g. konsultacja, cleaning?)
21. Currency — PLN only? Multi-currency needed?
22. VAT / paragon — "Wystaw paragon" is in the action list. Real fiscal printer integration, or just generating a PDF? Confirm scope.

## Messaging & triggers
23. Inbound replies — should they thread back into the same conversation automatically, or land in a separate inbox for review?
24. Trigger delays — fixed list (immediate / 1h / 24h) or arbitrary minutes? (Default: arbitrary, expressed in hours.)
25. Manual-confirmation queue — who has access? Owner only, or any admin user?
26. SMS character limits — auto-split long SMS, or warn the user? (Default: warn.)
27. Required initial trigger templates to ship with seed data: which ones? (Suggested: order received, status → ready, day-before pickup reminder, 3-days-after-handover review request.)

## Content
28. Do you have real Dr Shoes photos and copy ready to import into the seed, or should the seed use clearly-marked placeholders?
29. News post format — markdown editor, WYSIWYG, or block-based (Tiptap)? (Default: Tiptap-based WYSIWYG.)
30. Instagram embed on landing — wanted? (Default: link out only — IG embed APIs are flaky.)

## Technical preferences
31. **Frontend stack confirmation** — recommendation: Next.js (App Router) + React + TypeScript + Tailwind for both layers, with the public site SSG/ISR and the admin a client-rendered SPA section. Alternative: Astro for the marketing layer + Vite/React SPA for the admin. Which?
32. **Build tool / package manager** preference (pnpm default).
33. Auth model — JWT vs session cookies. Recommendation: HTTP-only session cookies for the admin (CSRF token via header). Confirm.
34. Anti-bot on public forms — Cloudflare Turnstile / hCaptcha / honeypot only? (Default: honeypot + rate limit; add Turnstile if abuse appears.)
35. Test coverage bar — backend ~70% on services + 100% on critical flows; frontend smoke tests only. Confirm or raise.

## Out of scope confirmation
36. Mobile native apps — out of scope?
37. POS / inventory beyond the shop reservation list — out of scope?
38. Customer-facing self-service portal (clients log in to see their order status) — out of scope, or a phase-2 candidate?

## Anything else
39. Any existing systems to migrate data from? (spreadsheet of past orders, Instagram DMs export, etc.)
40. Any compliance constraints? (GDPR/RODO is implicit — confirm consent UX expectations on public forms.)
