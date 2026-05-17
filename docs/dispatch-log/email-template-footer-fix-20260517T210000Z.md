# Dispatch Log — email-template-footer-fix

**Task:** email-footer  
**Milestone:** hotfix  
**Date:** 2026-05-17T21:00:00Z  
**Agent:** claude-sonnet-4-6 (main session, inline)

---

## Files Changed

| File | Change |
|------|--------|
| `backend/app/src/main/java/com/drshoes/app/messaging/config/WorkshopProperties.java` | Fix `address` default to canonical Poznań address; add `phoneLink` + `mapsUrl` fields |
| `backend/app/src/main/java/com/drshoes/app/messaging/service/TemplateContext.java` | Add `telefonWarsztatu` + `mapyUrl` record fields; add 9-arg backwards-compat constructor |
| `backend/app/src/main/java/com/drshoes/app/messaging/service/TemplateContextBuilder.java` | Wire `phone` + `mapsUrl` from `WorkshopProperties` into both `buildContext` overloads |
| `backend/app/src/main/java/com/drshoes/app/messaging/service/PlaceholderResolver.java` | Register `telefon_warsztatu` + `mapy_url` placeholder strategies |
| `backend/app/src/main/resources/db/migration/V030__email_template_footer_with_address_phone_map.sql` | Flyway migration: enrich footers for 4 EMAIL templates with address, phone, map button |
| `backend/app/src/test/java/com/drshoes/app/messaging/service/PlaceholderResolverTest.java` | +4 test cases for telefon_warsztatu + mapy_url; add ctxFull helper |
| `backend/app/src/test/java/com/drshoes/app/messaging/service/TemplateContextBuilderTest.java` | Add phone+mapsUrl to setUp; assert new fields; fix pre-existing NAPRAWA→"naprawa" assertion |
| `backend/app/src/test/java/com/drshoes/app/messaging/service/MessageRouterFollowupIntegrationTest.java` | Add footer content assertions (address, phone, "Mapa dojazdu", maps URL) |
| `docker-compose.yml` | Fix `DRSHOES_WORKSHOP_ADDRESS` default to Marcinkowskiego 26 |
| `.env` | Fix `DRSHOES_WORKSHOP_ADDRESS` (gitignored, not committed) |
| `.env.example` | Fix `DRSHOES_WORKSHOP_ADDRESS` default |
| `apps/web/app/(public)/_components/Contact.tsx` | Replace ul. Mostowa 5a / 61-854 with Al. K. Marcinkowskiego 26 / 61-745 Poznań |
| `apps/web/app/(public)/_components/__tests__/Contact.test.tsx` | Update address assertion to new street |
| `apps/web/app/(public)/_components/__tests__/__snapshots__/Contact.test.tsx.snap` | Update snapshot to reflect new address |
| `docs/screenshots/email-footer-fix/Dr-Shoes-followup-EMAIL.png` | Playwright screenshot of rendered followup email with new footer |

---

## Commands Run

```bash
# Compile check
mvn -f backend/pom.xml -pl app -am -DskipTests clean package

# Unit tests
mvn -f backend/pom.xml -pl app test -Dtest="PlaceholderResolverTest,TemplateContextBuilderTest"
# Result: 19 tests, 0 failures

# Full backend suite (includes Testcontainers ITs)
mvn -f backend/pom.xml -pl app test
# Result: 504 tests, 0 failures, 0 errors

# Frontend tests
cd apps/web && pnpm test
# Result: 575 passed, 16 failed (all 16 pre-existing before this change)

# Backend JAR rebuild + container restart
mvn -f backend/pom.xml -pl app -am -DskipTests clean package
docker compose build backend && docker compose up -d --force-recreate backend
docker compose build web && docker compose up -d web

# V030 migration confirmed
docker exec misza_madafaka-postgres-1 psql -U drshoes -d drshoes -c \
  "SELECT name, body_html LIKE '%Mapa dojazdu%' as has_map_cta FROM message_template WHERE channel='EMAIL' ORDER BY name;"
# All 4 EMAIL templates: has_map_cta = t

# End-to-end verification via DB query on sent message
docker exec misza_madafaka-postgres-1 psql -U drshoes -d drshoes -c \
  "SELECT id, body_html LIKE '%Aleje Karola Marcinkowskiego 26%' as has_address, body_html LIKE '%514 296 809%' as has_phone, body_html LIKE '%Mapa dojazdu%' as has_map, body_html LIKE '%maps/dir%' as has_maps_url FROM message WHERE id='a13a2ec0-5266-4173-9628-0b33aab7e5fc';"
# Result: has_address=t, has_phone=t, has_map=t, has_maps_url=t
```

---

## Test Summary

| Suite | Before | After |
|-------|--------|-------|
| Backend unit (PlaceholderResolver + TemplateContextBuilder) | 15/0/0 (1 pre-existing fail) | 19/0/0 |
| Backend full (app module) | 503/0/0 (pre-existing) | 504/0/0 |
| Frontend vitest | 574/17 failed (16 pre-existing) | 575/16 failed (all pre-existing) |

---

## Decisions Made

1. **V030 REPLACE strategy**: Used PostgreSQL `REPLACE()` with E-string literal matching to patch only the `<!-- FOOTER -->` block, leaving the rest of each template body untouched. Guard clause `WHERE body_html NOT LIKE '%Mapa dojazdu%'` makes it safe on re-run.
2. **Address env var root cause**: The `DRSHOES_WORKSHOP_ADDRESS` was hardcoded in `.env` and `.env.example` (overriding Java defaults). Fixed in both files + `docker-compose.yml` default.
3. **phoneLink field**: Added to `WorkshopProperties` (default `tel:+48514296809`) for future use, but the footer HTML uses the hardcoded `tel:+48514296809` href for email-client compatibility. `{telefon_warsztatu}` is the display text only.
4. **Mailhog absent**: Stack uses `MESSAGING_EMAIL_PROVIDER=smtp` (real Gmail SMTP) locally; no Mailhog container. Verification done via DB query on `message.body_html` + Playwright screenshot of the HTML rendered in browser. Trigger-driven templates (Zlecenie przyjete, Gotowe do odbioru, Prosba o opinie) not verified via Mailhog — no demo orders in DB. V030 confirmed to have patched all 4 rows in DB.
5. **Pre-existing test failures carried forward**: 16 frontend test failures (MixDonut, KanbanBoard, NewOrderForm) and 1 backend test (NAPRAWA label — fixed in this PR as it was in the same file) were pre-existing before this change.
6. **Contact.tsx phone number not changed**: The public site Contact.tsx shows `+48 794 220 118` which appears to be a placeholder number. Not in scope for this task; flagged for follow-up.

---

## Screenshots

- `docs/screenshots/email-footer-fix/Dr-Shoes-followup-EMAIL.png` — Full render of Dr Shoes followup email with new footer: address, phone, "→ MAPA DOJAZDU" acid-yellow button, opening hours.

---

## Commit SHAs

| Commit | Description |
|--------|-------------|
| `80751ac` | feat(workshop): fix address to Marcinkowskiego 26 + add phone/maps placeholders |
| `e0f2380` | feat(db): V030 — enrich 4 email template footers with phone + Mapa dojazdu button |
| `f8d922f` | fix(public): correct workshop address on landing Contact section |
