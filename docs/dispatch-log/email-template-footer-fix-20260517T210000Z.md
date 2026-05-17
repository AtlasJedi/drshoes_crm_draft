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

---

## Follow-up 2026-05-18

### Task #1 — Public-site phone mismatch: RESOLVED

**Commit:** `afda576` — `fix(public): align workshop phone to canonical +48 514 296 809`

Files changed:
- `apps/web/app/(public)/_components/Contact.tsx` — display text `+48 794 220 118` → `+48 514 296 809`; `tel:` href `+48794220118` → `+48514296809`
- `apps/web/app/(public)/_components/__tests__/Contact.test.tsx` — assertion updated to `/\+48 514 296 809/`
- `apps/web/app/(public)/_components/__tests__/__snapshots__/Contact.test.tsx.snap` — snapshot updated to reflect new href and display text

Frontend suite after fix: 575 passed / 16 failed (all 16 pre-existing, none introduced by this change).

---

### Task #2 — Trigger-template visual verification: RESOLVED

**Approach:** local render via HTTP server + sed substitution + Playwright screenshot. No real email sent. No demo DB rows created.

**Commit:** `638fc16` — `docs(email): add rendered-template screenshots for trigger templates`

**Screenshots:**
- `docs/screenshots/email-footer-fix/zlecenie-przyjete.png`
- `docs/screenshots/email-footer-fix/gotowe-do-odbioru.png`
- `docs/screenshots/email-footer-fix/prosba-o-opinie.png`

**Placeholder substitutions used (reproducible):**

| Placeholder | Sample value |
|-------------|-------------|
| `{imie_klienta}` | `Anna` |
| `{numer_zlecenia}` | `2026-0042` |
| `{typ_pracy}` | `naprawa podeszwy, czyszczenie` (zlecenie-przyjete only) |
| `{data_odbioru}` | `22.05.2026 o 14:00` (zlecenie-przyjete only) |
| `{nazwa_warsztatu}` | `Dr Shoes Poznań` |
| `{adres_warsztatu}` | `Aleje Karola Marcinkowskiego 26, 61-745 Poznań` |
| `{godziny_otwarcia}` | `pon–pt 10:00–18:00 · sob 11:00–15:00` |
| `{url_warsztatu}` | `https://drshoes.pl` (gotowe-do-odbioru + prosba-o-opinie only) |
| `{telefon_warsztatu}` | `+48 514 296 809` |
| `{mapy_url}` | `https://www.google.com/maps/dir/?api=1&destination=Aleje%20Karola%20Marcinkowskiego%2026%2C%2061-745%20Pozna%C5%84` |
| `{link_do_zdjec}` | `https://drshoes.pl/zdjecia/sample` (not present in any of these 3 templates) |
| `{wiadomosc_tresc}` | `` (empty — not present in any of these 3 templates) |

**Rendering tool:** `/tmp/email-renders/render.sh` (sed pipeline, 700×900 Playwright viewport, fullPage screenshot).

**Visual spot-check results:**

| Template | Header | Body | Footer address | Footer phone | MAPA DOJAZDU btn | Odpisz STOP | Raw placeholders |
|----------|--------|------|---------------|-------------|------------------|-------------|-----------------|
| Zlecenie przyjete | ✓ black + blue accent + PRZYJĘTE badge | ✓ Anna, 2026-0042, naprawa podeszwy, 22.05.2026 | ✓ | ✓ +48 514 296 809 bold | ✓ acid-yellow | ✓ | none |
| Gotowe do odbioru | ✓ black + pink accent + ODBIERZ badge | ✓ Anna, 2026-0042, address + hours in body | ✓ | ✓ +48 514 296 809 bold | ✓ acid-yellow | ✓ | none |
| Prosba o opinie | ✓ black + green accent | ✓ Anna, 2026-0042, WYSTAW OPINIĘ CTA | ✓ | ✓ +48 514 296 809 bold | ✓ acid-yellow | ✓ | none |

**Note discovered during rendering:** `{data_odbioru}` and `{typ_pracy}` are only present in `Zlecenie przyjete` (not in the other two). `{url_warsztatu}` is present in `Gotowe do odbioru` and `Prosba o opinie` (not in `Zlecenie przyjete`). All placeholders are covered by `PlaceholderResolver.java` — no surprises found.
