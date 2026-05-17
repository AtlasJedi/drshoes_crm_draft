-- V031 — Email footer typography v2: heavier weights, 2px border, acid-yellow map button.
--        Full structural rewrite of "Dr Shoes - followup (EMAIL)" to match Gotowe do odbioru
--        visual richness (in-body card, in-body CTA, sign-off, then footer block).
--
-- Change A: Replace V030 footer block in the 3 non-followup EMAIL templates.
--   Guard: NOT LIKE '%background:#d8ff3a;padding:0;%' — already migrated rows are no-ops.
--
-- Change B: Full body_html overwrite of "Dr Shoes - followup (EMAIL)".
--   Uses a targeted UPDATE by name — fully idempotent (overwrites same value each time).

-- ─── A-1. Zlecenie przyjete (EMAIL) ─────────────────────────────────────────────────────────────
UPDATE message_template
SET body_html = REPLACE(
    body_html,
    E'  <!-- FOOTER -->\n  <tr><td class="footer-bg mute-text" style="background:#ebe4d4;border-top:1px solid #d8d2c0;padding:24px 32px 28px;font-size:12px;line-height:18px;color:#6b6960;">\n    <div style="font-family:Impact,\'Arial Black\',\'Helvetica Inserat\',sans-serif;font-size:16px;line-height:20px;letter-spacing:.02em;text-transform:uppercase;color:#0a0a0a;font-weight:900;margin-bottom:10px;">{nazwa_warsztatu}</div>\n    <div class="ink-text" style="font-size:14px;line-height:21px;color:#0a0a0a;margin-bottom:4px;">{adres_warsztatu}</div>\n    <div class="ink-text" style="font-size:14px;line-height:21px;color:#0a0a0a;margin-bottom:4px;">tel. <a href="tel:+48514296809" style="color:#0a0a0a;text-decoration:none;font-weight:700;">{telefon_warsztatu}</a></div>\n    <div style="font-size:12px;line-height:18px;color:#6b6960;margin-bottom:16px;">{godziny_otwarcia}</div>\n    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:#0a0a0a;padding:0;">\n      <a href="{mapy_url}" target="_blank" rel="noopener" style="display:inline-block;background:#0a0a0a;color:#d8ff3a;text-decoration:none;font-family:Impact,\'Arial Black\',\'Helvetica Inserat\',sans-serif;font-size:14px;line-height:14px;letter-spacing:.14em;text-transform:uppercase;padding:14px 22px;font-weight:900;">&#x2192; Mapa dojazdu</a>\n    </td></tr></table>\n    <div style="margin-top:18px;font-size:11px;line-height:16px;color:#6b6960;opacity:.85;">Odpisz STOP, jeśli nie chcesz dostawać powiadomień o swoich zleceniach.</div>\n  </td></tr>',
    E'  <!-- FOOTER -->\n  <tr><td class="footer-bg ink-text" style="background:#ebe4d4;border-top:2px solid #0a0a0a;padding:28px 32px 30px;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;color:#0a0a0a;">\n    <div style="font-family:Impact,\'Arial Black\',\'Helvetica Inserat\',sans-serif;font-size:20px;line-height:22px;letter-spacing:.02em;text-transform:uppercase;color:#0a0a0a;font-weight:900;margin-bottom:14px;">{nazwa_warsztatu}</div>\n    <div style="font-size:15px;line-height:22px;color:#0a0a0a;font-weight:600;margin-bottom:6px;">{adres_warsztatu}</div>\n    <div style="font-size:15px;line-height:22px;color:#0a0a0a;margin-bottom:6px;">tel. <a href="tel:+48514296809" style="color:#0a0a0a;text-decoration:none;font-weight:700;">{telefon_warsztatu}</a></div>\n    <div style="font-size:13px;line-height:20px;color:#3a3833;margin-bottom:18px;">{godziny_otwarcia}</div>\n    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:#d8ff3a;padding:0;">\n      <a href="{mapy_url}" target="_blank" rel="noopener" style="display:inline-block;background:#d8ff3a;color:#0a0a0a;text-decoration:none;font-family:Impact,\'Arial Black\',\'Helvetica Inserat\',sans-serif;font-size:15px;line-height:15px;letter-spacing:.14em;text-transform:uppercase;padding:14px 24px;font-weight:900;">&#x2192; Mapa dojazdu</a>\n    </td></tr></table>\n    <div style="margin-top:20px;font-size:11px;line-height:16px;color:#6b6960;opacity:.85;">Odpisz STOP, jeśli nie chcesz dostawać powiadomień o swoich zleceniach.</div>\n  </td></tr>'
)
WHERE name = 'Zlecenie przyjete (EMAIL)'
  AND body_html IS NOT NULL
  AND body_html NOT LIKE '%background:#d8ff3a;padding:0;%';

-- ─── A-2. Gotowe do odbioru (EMAIL) ─────────────────────────────────────────────────────────────
UPDATE message_template
SET body_html = REPLACE(
    body_html,
    E'  <!-- FOOTER -->\n  <tr><td class="footer-bg mute-text" style="background:#ebe4d4;border-top:1px solid #d8d2c0;padding:24px 32px 28px;font-size:12px;line-height:18px;color:#6b6960;">\n    <div style="font-family:Impact,\'Arial Black\',\'Helvetica Inserat\',sans-serif;font-size:16px;line-height:20px;letter-spacing:.02em;text-transform:uppercase;color:#0a0a0a;font-weight:900;margin-bottom:10px;">{nazwa_warsztatu}</div>\n    <div class="ink-text" style="font-size:14px;line-height:21px;color:#0a0a0a;margin-bottom:4px;">{adres_warsztatu}</div>\n    <div class="ink-text" style="font-size:14px;line-height:21px;color:#0a0a0a;margin-bottom:4px;">tel. <a href="tel:+48514296809" style="color:#0a0a0a;text-decoration:none;font-weight:700;">{telefon_warsztatu}</a></div>\n    <div style="font-size:12px;line-height:18px;color:#6b6960;margin-bottom:16px;">{godziny_otwarcia}</div>\n    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:#0a0a0a;padding:0;">\n      <a href="{mapy_url}" target="_blank" rel="noopener" style="display:inline-block;background:#0a0a0a;color:#d8ff3a;text-decoration:none;font-family:Impact,\'Arial Black\',\'Helvetica Inserat\',sans-serif;font-size:14px;line-height:14px;letter-spacing:.14em;text-transform:uppercase;padding:14px 22px;font-weight:900;">&#x2192; Mapa dojazdu</a>\n    </td></tr></table>\n    <div style="margin-top:18px;font-size:11px;line-height:16px;color:#6b6960;opacity:.85;">Odpisz STOP, jeśli nie chcesz dostawać powiadomień o swoich zleceniach.</div>\n  </td></tr>',
    E'  <!-- FOOTER -->\n  <tr><td class="footer-bg ink-text" style="background:#ebe4d4;border-top:2px solid #0a0a0a;padding:28px 32px 30px;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;color:#0a0a0a;">\n    <div style="font-family:Impact,\'Arial Black\',\'Helvetica Inserat\',sans-serif;font-size:20px;line-height:22px;letter-spacing:.02em;text-transform:uppercase;color:#0a0a0a;font-weight:900;margin-bottom:14px;">{nazwa_warsztatu}</div>\n    <div style="font-size:15px;line-height:22px;color:#0a0a0a;font-weight:600;margin-bottom:6px;">{adres_warsztatu}</div>\n    <div style="font-size:15px;line-height:22px;color:#0a0a0a;margin-bottom:6px;">tel. <a href="tel:+48514296809" style="color:#0a0a0a;text-decoration:none;font-weight:700;">{telefon_warsztatu}</a></div>\n    <div style="font-size:13px;line-height:20px;color:#3a3833;margin-bottom:18px;">{godziny_otwarcia}</div>\n    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:#d8ff3a;padding:0;">\n      <a href="{mapy_url}" target="_blank" rel="noopener" style="display:inline-block;background:#d8ff3a;color:#0a0a0a;text-decoration:none;font-family:Impact,\'Arial Black\',\'Helvetica Inserat\',sans-serif;font-size:15px;line-height:15px;letter-spacing:.14em;text-transform:uppercase;padding:14px 24px;font-weight:900;">&#x2192; Mapa dojazdu</a>\n    </td></tr></table>\n    <div style="margin-top:20px;font-size:11px;line-height:16px;color:#6b6960;opacity:.85;">Odpisz STOP, jeśli nie chcesz dostawać powiadomień o swoich zleceniach.</div>\n  </td></tr>'
)
WHERE name = 'Gotowe do odbioru (EMAIL)'
  AND body_html IS NOT NULL
  AND body_html NOT LIKE '%background:#d8ff3a;padding:0;%';

-- ─── A-3. Prosba o opinie (EMAIL) ───────────────────────────────────────────────────────────────
UPDATE message_template
SET body_html = REPLACE(
    body_html,
    E'  <!-- FOOTER -->\n  <tr><td class="footer-bg mute-text" style="background:#ebe4d4;border-top:1px solid #d8d2c0;padding:24px 32px 28px;font-size:12px;line-height:18px;color:#6b6960;">\n    <div style="font-family:Impact,\'Arial Black\',\'Helvetica Inserat\',sans-serif;font-size:16px;line-height:20px;letter-spacing:.02em;text-transform:uppercase;color:#0a0a0a;font-weight:900;margin-bottom:10px;">{nazwa_warsztatu}</div>\n    <div class="ink-text" style="font-size:14px;line-height:21px;color:#0a0a0a;margin-bottom:4px;">{adres_warsztatu}</div>\n    <div class="ink-text" style="font-size:14px;line-height:21px;color:#0a0a0a;margin-bottom:4px;">tel. <a href="tel:+48514296809" style="color:#0a0a0a;text-decoration:none;font-weight:700;">{telefon_warsztatu}</a></div>\n    <div style="font-size:12px;line-height:18px;color:#6b6960;margin-bottom:16px;">{godziny_otwarcia}</div>\n    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:#0a0a0a;padding:0;">\n      <a href="{mapy_url}" target="_blank" rel="noopener" style="display:inline-block;background:#0a0a0a;color:#d8ff3a;text-decoration:none;font-family:Impact,\'Arial Black\',\'Helvetica Inserat\',sans-serif;font-size:14px;line-height:14px;letter-spacing:.14em;text-transform:uppercase;padding:14px 22px;font-weight:900;">&#x2192; Mapa dojazdu</a>\n    </td></tr></table>\n    <div style="margin-top:18px;font-size:11px;line-height:16px;color:#6b6960;opacity:.85;">Odpisz STOP, jeśli nie chcesz dostawać powiadomień o swoich zleceniach.</div>\n  </td></tr>',
    E'  <!-- FOOTER -->\n  <tr><td class="footer-bg ink-text" style="background:#ebe4d4;border-top:2px solid #0a0a0a;padding:28px 32px 30px;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;color:#0a0a0a;">\n    <div style="font-family:Impact,\'Arial Black\',\'Helvetica Inserat\',sans-serif;font-size:20px;line-height:22px;letter-spacing:.02em;text-transform:uppercase;color:#0a0a0a;font-weight:900;margin-bottom:14px;">{nazwa_warsztatu}</div>\n    <div style="font-size:15px;line-height:22px;color:#0a0a0a;font-weight:600;margin-bottom:6px;">{adres_warsztatu}</div>\n    <div style="font-size:15px;line-height:22px;color:#0a0a0a;margin-bottom:6px;">tel. <a href="tel:+48514296809" style="color:#0a0a0a;text-decoration:none;font-weight:700;">{telefon_warsztatu}</a></div>\n    <div style="font-size:13px;line-height:20px;color:#3a3833;margin-bottom:18px;">{godziny_otwarcia}</div>\n    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:#d8ff3a;padding:0;">\n      <a href="{mapy_url}" target="_blank" rel="noopener" style="display:inline-block;background:#d8ff3a;color:#0a0a0a;text-decoration:none;font-family:Impact,\'Arial Black\',\'Helvetica Inserat\',sans-serif;font-size:15px;line-height:15px;letter-spacing:.14em;text-transform:uppercase;padding:14px 24px;font-weight:900;">&#x2192; Mapa dojazdu</a>\n    </td></tr></table>\n    <div style="margin-top:20px;font-size:11px;line-height:16px;color:#6b6960;opacity:.85;">Odpisz STOP, jeśli nie chcesz dostawać powiadomień o swoich zleceniach.</div>\n  </td></tr>'
)
WHERE name = 'Prosba o opinie (EMAIL)'
  AND body_html IS NOT NULL
  AND body_html NOT LIKE '%background:#d8ff3a;padding:0;%';

-- ─── B. Dr Shoes - followup (EMAIL) — full body_html structural rewrite ──────────────────────────
-- Mirrors Gotowe do odbioru's card/CTA/sign-off structure.
-- Body sits inside the cream card, adds in-body "Zobacz na mapie" CTA, sign-off line,
-- then the new v2 footer block. Footer is now INSIDE the card structure (not orphaned).
UPDATE message_template
SET body_html = $$<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<title>Dr Shoes</title>
<style>
  @media (prefers-color-scheme: dark) {
    body, .body-bg { background:#0a0a0a !important; }
    .stage-bg { background:#161616 !important; }
    .ink-text { color:#f4efe6 !important; }
    .mute-text { color:#b8b3a5 !important; }
  }
</style>
</head>
<body class="body-bg" style="margin:0;padding:0;background:#ebe4d4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0a0a0a;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ebe4d4;">
<tr><td align="center" style="padding:24px 12px;">

<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;">

  <!-- HEADER -->
  <tr><td style="background:#0a0a0a;padding:24px 32px 22px;">
    <div style="font-family:Impact,'Arial Black','Helvetica Inserat',sans-serif;color:#f4efe6;font-size:32px;line-height:32px;letter-spacing:.02em;text-transform:uppercase;font-weight:900;">DR.SHOES</div>
    <div style="font-family:'SF Mono','Menlo','Consolas',monospace;color:#d8ff3a;font-size:10px;line-height:14px;letter-spacing:.18em;text-transform:uppercase;margin-top:6px;">warsztat szewski · poznań</div>
  </td></tr>

  <!-- ACCENT BAR -->
  <tr><td height="6" style="background:#d8ff3a;height:6px;font-size:0;line-height:0;mso-line-height-rule:exactly;">&nbsp;</td></tr>

  <!-- BODY — operator free-form message inside the cream card -->
  <tr><td class="stage-bg" style="background:#f4efe6;padding:36px 32px 28px;">
    <div class="ink-text" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:25px;color:#0a0a0a;white-space:pre-wrap;word-wrap:break-word;">{wiadomosc_tresc}</div>
  </td></tr>

  <!-- IN-BODY MAP CTA -->
  <tr><td class="stage-bg" style="background:#f4efe6;padding:0 32px 32px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:#d8ff3a;padding:0;">
      <a href="{mapy_url}" target="_blank" rel="noopener" style="display:inline-block;background:#d8ff3a;color:#0a0a0a;text-decoration:none;font-family:Impact,'Arial Black','Helvetica Inserat',sans-serif;font-size:16px;line-height:16px;letter-spacing:.14em;text-transform:uppercase;padding:16px 26px;font-weight:900;">Zobacz na mapie &#x2192;</a>
    </td></tr></table>
  </td></tr>

  <!-- SIGN OFF -->
  <tr><td class="stage-bg ink-text" style="background:#f4efe6;padding:0 32px 36px;font-size:15px;line-height:22px;color:#0a0a0a;">
    Pozdrawiamy,<br />ekipa <strong>{nazwa_warsztatu}</strong>
  </td></tr>

  <!-- FOOTER -->
  <tr><td class="footer-bg ink-text" style="background:#ebe4d4;border-top:2px solid #0a0a0a;padding:28px 32px 30px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0a0a0a;">
    <div style="font-family:Impact,'Arial Black','Helvetica Inserat',sans-serif;font-size:20px;line-height:22px;letter-spacing:.02em;text-transform:uppercase;color:#0a0a0a;font-weight:900;margin-bottom:14px;">{nazwa_warsztatu}</div>
    <div style="font-size:15px;line-height:22px;color:#0a0a0a;font-weight:600;margin-bottom:6px;">{adres_warsztatu}</div>
    <div style="font-size:15px;line-height:22px;color:#0a0a0a;margin-bottom:6px;">tel. <a href="tel:+48514296809" style="color:#0a0a0a;text-decoration:none;font-weight:700;">{telefon_warsztatu}</a></div>
    <div style="font-size:13px;line-height:20px;color:#3a3833;margin-bottom:18px;">{godziny_otwarcia}</div>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:#d8ff3a;padding:0;">
      <a href="{mapy_url}" target="_blank" rel="noopener" style="display:inline-block;background:#d8ff3a;color:#0a0a0a;text-decoration:none;font-family:Impact,'Arial Black','Helvetica Inserat',sans-serif;font-size:15px;line-height:15px;letter-spacing:.14em;text-transform:uppercase;padding:14px 24px;font-weight:900;">&#x2192; Mapa dojazdu</a>
    </td></tr></table>
    <div style="margin-top:20px;font-size:11px;line-height:16px;color:#6b6960;opacity:.85;">Odpisz STOP, jeśli nie chcesz dostawać powiadomień o swoich zleceniach.</div>
  </td></tr>

</table>

</td></tr>
</table>
</body>
</html>$$
WHERE name = 'Dr Shoes - followup (EMAIL)';
