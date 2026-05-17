-- V030 — Enrich email template footers with full address, phone, and "Mapa dojazdu" CTA button.
-- Affects 4 EMAIL templates:
--   1. Zlecenie przyjete (EMAIL)    — adds phone + map button to existing footer
--   2. Gotowe do odbioru (EMAIL)    — adds phone + map button to existing footer
--   3. Prosba o opinie (EMAIL)      — adds phone + map button to existing footer
--   4. Dr Shoes - followup (EMAIL)  — rewrites stub footer to full branded footer
--
-- Guard: WHERE ... NOT LIKE '%Mapa dojazdu%' makes each UPDATE a no-op on already-migrated rows.
-- Flyway never reruns migrations, but this guard is belt-and-suspenders for Testcontainers.

-- ─── 1. Zlecenie przyjete (EMAIL) ─────────────────────────────────────────────────────────────
UPDATE message_template
SET body_html = REPLACE(
    body_html,
    E'  <!-- FOOTER -->\n  <tr><td class="footer-bg mute-text" style="background:#ebe4d4;border-top:1px solid #d8d2c0;padding:20px 32px 24px;font-size:12px;line-height:18px;color:#6b6960;">\n    <strong class="ink-text" style="color:#0a0a0a;">{nazwa_warsztatu}</strong><br />\n    {adres_warsztatu} · {godziny_otwarcia}<br />\n    <span style="opacity:.85;">Odpisz STOP, jeśli nie chcesz dostawać powiadomień o swoich zleceniach.</span>\n  </td></tr>',
    E'  <!-- FOOTER -->\n  <tr><td class="footer-bg mute-text" style="background:#ebe4d4;border-top:1px solid #d8d2c0;padding:24px 32px 28px;font-size:12px;line-height:18px;color:#6b6960;">\n    <div style="font-family:Impact,\'Arial Black\',\'Helvetica Inserat\',sans-serif;font-size:16px;line-height:20px;letter-spacing:.02em;text-transform:uppercase;color:#0a0a0a;font-weight:900;margin-bottom:10px;">{nazwa_warsztatu}</div>\n    <div class="ink-text" style="font-size:14px;line-height:21px;color:#0a0a0a;margin-bottom:4px;">{adres_warsztatu}</div>\n    <div class="ink-text" style="font-size:14px;line-height:21px;color:#0a0a0a;margin-bottom:4px;">tel. <a href="tel:+48514296809" style="color:#0a0a0a;text-decoration:none;font-weight:700;">{telefon_warsztatu}</a></div>\n    <div style="font-size:12px;line-height:18px;color:#6b6960;margin-bottom:16px;">{godziny_otwarcia}</div>\n    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:#0a0a0a;padding:0;">\n      <a href="{mapy_url}" target="_blank" rel="noopener" style="display:inline-block;background:#0a0a0a;color:#d8ff3a;text-decoration:none;font-family:Impact,\'Arial Black\',\'Helvetica Inserat\',sans-serif;font-size:14px;line-height:14px;letter-spacing:.14em;text-transform:uppercase;padding:14px 22px;font-weight:900;">&#x2192; Mapa dojazdu</a>\n    </td></tr></table>\n    <div style="margin-top:18px;font-size:11px;line-height:16px;color:#6b6960;opacity:.85;">Odpisz STOP, jeśli nie chcesz dostawać powiadomień o swoich zleceniach.</div>\n  </td></tr>'
)
WHERE name = 'Zlecenie przyjete (EMAIL)'
  AND body_html IS NOT NULL
  AND body_html NOT LIKE '%Mapa dojazdu%';

-- ─── 2. Gotowe do odbioru (EMAIL) ─────────────────────────────────────────────────────────────
UPDATE message_template
SET body_html = REPLACE(
    body_html,
    E'  <!-- FOOTER -->\n  <tr><td class="footer-bg mute-text" style="background:#ebe4d4;border-top:1px solid #d8d2c0;padding:20px 32px 24px;font-size:12px;line-height:18px;color:#6b6960;">\n    <strong class="ink-text" style="color:#0a0a0a;">{nazwa_warsztatu}</strong><br />\n    {adres_warsztatu} · {godziny_otwarcia}<br />\n    <span style="opacity:.85;">Odpisz STOP, jeśli nie chcesz dostawać powiadomień o swoich zleceniach.</span>\n  </td></tr>',
    E'  <!-- FOOTER -->\n  <tr><td class="footer-bg mute-text" style="background:#ebe4d4;border-top:1px solid #d8d2c0;padding:24px 32px 28px;font-size:12px;line-height:18px;color:#6b6960;">\n    <div style="font-family:Impact,\'Arial Black\',\'Helvetica Inserat\',sans-serif;font-size:16px;line-height:20px;letter-spacing:.02em;text-transform:uppercase;color:#0a0a0a;font-weight:900;margin-bottom:10px;">{nazwa_warsztatu}</div>\n    <div class="ink-text" style="font-size:14px;line-height:21px;color:#0a0a0a;margin-bottom:4px;">{adres_warsztatu}</div>\n    <div class="ink-text" style="font-size:14px;line-height:21px;color:#0a0a0a;margin-bottom:4px;">tel. <a href="tel:+48514296809" style="color:#0a0a0a;text-decoration:none;font-weight:700;">{telefon_warsztatu}</a></div>\n    <div style="font-size:12px;line-height:18px;color:#6b6960;margin-bottom:16px;">{godziny_otwarcia}</div>\n    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:#0a0a0a;padding:0;">\n      <a href="{mapy_url}" target="_blank" rel="noopener" style="display:inline-block;background:#0a0a0a;color:#d8ff3a;text-decoration:none;font-family:Impact,\'Arial Black\',\'Helvetica Inserat\',sans-serif;font-size:14px;line-height:14px;letter-spacing:.14em;text-transform:uppercase;padding:14px 22px;font-weight:900;">&#x2192; Mapa dojazdu</a>\n    </td></tr></table>\n    <div style="margin-top:18px;font-size:11px;line-height:16px;color:#6b6960;opacity:.85;">Odpisz STOP, jeśli nie chcesz dostawać powiadomień o swoich zleceniach.</div>\n  </td></tr>'
)
WHERE name = 'Gotowe do odbioru (EMAIL)'
  AND body_html IS NOT NULL
  AND body_html NOT LIKE '%Mapa dojazdu%';

-- ─── 3. Prosba o opinie (EMAIL) ───────────────────────────────────────────────────────────────
UPDATE message_template
SET body_html = REPLACE(
    body_html,
    E'  <!-- FOOTER -->\n  <tr><td class="footer-bg mute-text" style="background:#ebe4d4;border-top:1px solid #d8d2c0;padding:20px 32px 24px;font-size:12px;line-height:18px;color:#6b6960;">\n    <strong class="ink-text" style="color:#0a0a0a;">{nazwa_warsztatu}</strong><br />\n    {adres_warsztatu} · {godziny_otwarcia}<br />\n    <span style="opacity:.85;">Odpisz STOP, jeśli nie chcesz dostawać powiadomień o swoich zleceniach.</span>\n  </td></tr>',
    E'  <!-- FOOTER -->\n  <tr><td class="footer-bg mute-text" style="background:#ebe4d4;border-top:1px solid #d8d2c0;padding:24px 32px 28px;font-size:12px;line-height:18px;color:#6b6960;">\n    <div style="font-family:Impact,\'Arial Black\',\'Helvetica Inserat\',sans-serif;font-size:16px;line-height:20px;letter-spacing:.02em;text-transform:uppercase;color:#0a0a0a;font-weight:900;margin-bottom:10px;">{nazwa_warsztatu}</div>\n    <div class="ink-text" style="font-size:14px;line-height:21px;color:#0a0a0a;margin-bottom:4px;">{adres_warsztatu}</div>\n    <div class="ink-text" style="font-size:14px;line-height:21px;color:#0a0a0a;margin-bottom:4px;">tel. <a href="tel:+48514296809" style="color:#0a0a0a;text-decoration:none;font-weight:700;">{telefon_warsztatu}</a></div>\n    <div style="font-size:12px;line-height:18px;color:#6b6960;margin-bottom:16px;">{godziny_otwarcia}</div>\n    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:#0a0a0a;padding:0;">\n      <a href="{mapy_url}" target="_blank" rel="noopener" style="display:inline-block;background:#0a0a0a;color:#d8ff3a;text-decoration:none;font-family:Impact,\'Arial Black\',\'Helvetica Inserat\',sans-serif;font-size:14px;line-height:14px;letter-spacing:.14em;text-transform:uppercase;padding:14px 22px;font-weight:900;">&#x2192; Mapa dojazdu</a>\n    </td></tr></table>\n    <div style="margin-top:18px;font-size:11px;line-height:16px;color:#6b6960;opacity:.85;">Odpisz STOP, jeśli nie chcesz dostawać powiadomień o swoich zleceniach.</div>\n  </td></tr>'
)
WHERE name = 'Prosba o opinie (EMAIL)'
  AND body_html IS NOT NULL
  AND body_html NOT LIKE '%Mapa dojazdu%';

-- ─── 4. Dr Shoes - followup (EMAIL) — replace stub footer with full branded footer ───────────
UPDATE message_template
SET body_html = REPLACE(
    body_html,
    E'  <!-- FOOTER -->\n  <tr><td class="mute-text" style="background:#ebe4d4;border-top:1px solid #d8d2c0;padding:20px 32px 24px;font-size:12px;line-height:18px;color:#6b6960;">\n    <strong class="ink-text" style="color:#0a0a0a;">Dr Shoes</strong> · Poznań\n  </td></tr>',
    E'  <!-- FOOTER -->\n  <tr><td class="footer-bg mute-text" style="background:#ebe4d4;border-top:1px solid #d8d2c0;padding:24px 32px 28px;font-size:12px;line-height:18px;color:#6b6960;">\n    <div style="font-family:Impact,\'Arial Black\',\'Helvetica Inserat\',sans-serif;font-size:16px;line-height:20px;letter-spacing:.02em;text-transform:uppercase;color:#0a0a0a;font-weight:900;margin-bottom:10px;">{nazwa_warsztatu}</div>\n    <div class="ink-text" style="font-size:14px;line-height:21px;color:#0a0a0a;margin-bottom:4px;">{adres_warsztatu}</div>\n    <div class="ink-text" style="font-size:14px;line-height:21px;color:#0a0a0a;margin-bottom:4px;">tel. <a href="tel:+48514296809" style="color:#0a0a0a;text-decoration:none;font-weight:700;">{telefon_warsztatu}</a></div>\n    <div style="font-size:12px;line-height:18px;color:#6b6960;margin-bottom:16px;">{godziny_otwarcia}</div>\n    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:#0a0a0a;padding:0;">\n      <a href="{mapy_url}" target="_blank" rel="noopener" style="display:inline-block;background:#0a0a0a;color:#d8ff3a;text-decoration:none;font-family:Impact,\'Arial Black\',\'Helvetica Inserat\',sans-serif;font-size:14px;line-height:14px;letter-spacing:.14em;text-transform:uppercase;padding:14px 22px;font-weight:900;">&#x2192; Mapa dojazdu</a>\n    </td></tr></table>\n    <div style="margin-top:18px;font-size:11px;line-height:16px;color:#6b6960;opacity:.85;">Odpisz STOP, jeśli nie chcesz dostawać powiadomień o swoich zleceniach.</div>\n  </td></tr>'
)
WHERE name = 'Dr Shoes - followup (EMAIL)'
  AND body_html IS NOT NULL
  AND body_html NOT LIKE '%Mapa dojazdu%';
