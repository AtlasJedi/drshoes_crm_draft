-- Owner feedback 2026-05-18: remove the in-body "Zobacz na mapie →" CTA from the
-- followup (custom-message) wrapper. The footer already has "→ Mapa dojazdu", so
-- two map buttons stacked = visual duplication.
--
-- Surgical removal: delete everything from the IN-BODY MAP CTA opening marker
-- through to (but not including) the SIGN OFF marker. WHERE-guarded so the
-- migration is a no-op on re-run (Flyway only runs once anyway, but this also
-- protects against repeat application via psql).

UPDATE message_template
SET body_html = regexp_replace(
    body_html,
    E'  <!-- IN-BODY MAP CTA.*?  <!-- SIGN OFF',
    E'  <!-- SIGN OFF',
    'sn'
)
WHERE name = 'Dr Shoes - followup (EMAIL)'
  AND body_html LIKE '%IN-BODY MAP CTA%';
