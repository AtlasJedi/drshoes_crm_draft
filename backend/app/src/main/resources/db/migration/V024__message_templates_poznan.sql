-- M11 owner correction: workshop city is Poznań, not Wrocław.
-- V022 seeded both body (plain) and body_html (designer HTML) with hardcoded "Wrocław"
-- city strings. WorkshopProperties already defaults to Poznań; this migration just
-- aligns the seeded message_template rows.

UPDATE message_template
SET body = REPLACE(REPLACE(body, 'Wrocław', 'Poznań'), 'wrocław', 'poznań')
WHERE body IS NOT NULL
  AND (body LIKE '%Wrocław%' OR body LIKE '%wrocław%');

UPDATE message_template
SET body_html = REPLACE(REPLACE(body_html, 'Wrocław', 'Poznań'), 'wrocław', 'poznań')
WHERE body_html IS NOT NULL
  AND (body_html LIKE '%Wrocław%' OR body_html LIKE '%wrocław%');
