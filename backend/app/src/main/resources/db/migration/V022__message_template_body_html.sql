-- =============================================================================
-- V022 — body_html column on message_template and message
-- Seeds 3 EMAIL templates with designer-shipped HTML + matching plain-text fallback.
-- Also adds body_html to message table for storing rendered HTML output.
-- =============================================================================

ALTER TABLE message_template ADD COLUMN body_html TEXT;
ALTER TABLE message          ADD COLUMN body_html TEXT;

UPDATE message_template
SET body_html = $body$<!--
  ┌─────────────────────────────────────────────────────────────┐
  │ TEMPLATE: ORDER_RECEIVED                                    │
  │ Subject:    Mamy Twoje buty · zlecenie {numer_zlecenia}     │
  │ Preheader:  Zlecenie przyjęte. Damy znać gdy będzie gotowe. │
  │ Status:     --blue (#2b5cff)                                │
  │ Gesty:      accent bar + tape "PRZYJĘTE"                    │
  │ Placeholders: {imie_klienta} {numer_zlecenia} {typ_pracy}   │
  │               {data_odbioru} {nazwa_warsztatu}              │
  │               {adres_warsztatu} {godziny_otwarcia}          │
  └─────────────────────────────────────────────────────────────┘
-->
<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<title>Mamy Twoje buty · zlecenie {numer_zlecenia}</title>
<style>
  @media (prefers-color-scheme: dark) {
    body, .body-bg { background:#0a0a0a !important; }
    .stage-bg { background:#161616 !important; }
    .ink-text { color:#f4efe6 !important; }
    .mute-text { color:#b8b3a5 !important; }
    .line-b { border-bottom-color:#2a2a2a !important; }
    .footer-bg { background:#161616 !important; }
    .code-card { background:#0a0a0a !important; border-color:#3a3a3a !important; }
    .accent { background:#4a82ff !important; }
  }
  @media only screen and (max-width:480px) {
    .px-32 { padding-left:20px !important; padding-right:20px !important; }
    .order-num { font-size:36px !important; line-height:40px !important; }
    .headline { font-size:24px !important; line-height:28px !important; }
    .wordmark { font-size:26px !important; line-height:26px !important; }
  }
</style>
</head>
<body class="body-bg" style="margin:0;padding:0;background:#ebe4d4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0a0a0a;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:transparent;opacity:0;mso-hide:all;">
Zlecenie przyjęte. Damy znać, gdy będzie gotowe.&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ebe4d4;">
<tr><td align="center" style="padding:24px 12px;">

<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;">

  <!-- HEADER -->
  <tr><td style="background:#0a0a0a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td class="px-32" valign="top" style="padding:24px 32px 22px;">
          <div class="wordmark" style="font-family:Impact,'Arial Black','Helvetica Inserat',sans-serif;color:#f4efe6;font-size:32px;line-height:32px;letter-spacing:.02em;text-transform:uppercase;font-weight:900;">DR.SHOES</div>
          <div style="font-family:'SF Mono','Menlo','Consolas',monospace;color:#d8ff3a;font-size:10px;line-height:14px;letter-spacing:.18em;text-transform:uppercase;margin-top:6px;">warsztat szewski · wrocław</div>
        </td>
        <td class="px-32" align="right" valign="middle" width="150" style="padding:24px 32px 22px;text-align:right;">
          <div style="display:inline-block;background:#2b5cff;color:#f4efe6;font-family:Impact,'Arial Black',sans-serif;font-size:13px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;padding:5px 12px;transform:rotate(-2deg);">Przyjęte</div>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- ACCENT BAR -->
  <tr><td class="accent" height="6" style="background:#2b5cff;height:6px;font-size:0;line-height:0;mso-line-height-rule:exactly;">&nbsp;</td></tr>

  <!-- BODY -->
  <tr><td class="stage-bg px-32" style="background:#f4efe6;padding:36px 32px 8px;">
    <p class="mute-text" style="margin:0 0 8px;font-size:15px;line-height:22px;color:#6b6960;">Cześć {imie_klienta},</p>
    <h1 class="headline ink-text" style="margin:0 0 14px;font-family:Impact,'Arial Black',sans-serif;font-size:32px;line-height:34px;letter-spacing:-.01em;text-transform:uppercase;color:#0a0a0a;font-weight:900;">Twoje buty są u nas.</h1>
    <p class="ink-text" style="margin:0 0 28px;font-size:16px;line-height:24px;color:#0a0a0a;">Przyjęliśmy zlecenie. Damy znać, gdy będzie gotowe — nie musisz nic robić.</p>
  </td></tr>

  <!-- ORDER CODE -->
  <tr><td class="stage-bg px-32" style="background:#f4efe6;padding:0 32px 28px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="code-card" style="border:2px solid #0a0a0a;background:#ebe4d4;">
      <tr><td style="padding:18px 22px 20px;">
        <div class="mute-text" style="font-family:'SF Mono','Menlo','Consolas',monospace;font-size:10px;line-height:14px;letter-spacing:.18em;text-transform:uppercase;color:#6b6960;margin-bottom:6px;">Zlecenie</div>
        <div class="order-num ink-text" style="font-family:Impact,'Arial Black','Helvetica Inserat',sans-serif;font-size:48px;line-height:48px;letter-spacing:-.02em;color:#0a0a0a;font-weight:900;">{numer_zlecenia}</div>
      </td></tr>
    </table>
  </td></tr>

  <!-- DETAILS -->
  <tr><td class="stage-bg px-32" style="background:#f4efe6;padding:0 32px 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td class="line-b mute-text" width="160" valign="top" style="padding:14px 0;border-bottom:1px solid #d8d2c0;font-family:'SF Mono','Menlo','Consolas',monospace;font-size:11px;line-height:16px;letter-spacing:.14em;text-transform:uppercase;color:#6b6960;">Praca</td>
        <td class="line-b ink-text" valign="top" style="padding:14px 0;border-bottom:1px solid #d8d2c0;font-size:16px;line-height:22px;color:#0a0a0a;">{typ_pracy}</td>
      </tr>
      <tr>
        <td class="mute-text" width="160" valign="top" style="padding:14px 0 0;font-family:'SF Mono','Menlo','Consolas',monospace;font-size:11px;line-height:16px;letter-spacing:.14em;text-transform:uppercase;color:#6b6960;">Data odbioru</td>
        <td class="ink-text" valign="top" style="padding:14px 0 0;font-size:16px;line-height:22px;color:#0a0a0a;">{data_odbioru}</td>
      </tr>
    </table>
  </td></tr>

  <!-- SIGN OFF -->
  <tr><td class="stage-bg px-32 ink-text" style="background:#f4efe6;padding:0 32px 40px;font-size:15px;line-height:22px;color:#0a0a0a;">
    Do zobaczenia,<br />ekipa <strong>{nazwa_warsztatu}</strong>
  </td></tr>

  <!-- FOOTER -->
  <tr><td class="footer-bg mute-text" style="background:#ebe4d4;border-top:1px solid #d8d2c0;padding:20px 32px 24px;font-size:12px;line-height:18px;color:#6b6960;">
    <strong class="ink-text" style="color:#0a0a0a;">{nazwa_warsztatu}</strong><br />
    {adres_warsztatu} · {godziny_otwarcia}<br />
    <span style="opacity:.85;">Odpisz STOP, jeśli nie chcesz dostawać powiadomień o swoich zleceniach.</span>
  </td></tr>

</table>

</td></tr>
</table>
</body>
</html>
$body$,
    body      = $txtbody$======================================================================
  DR.SHOES — warsztat szewski, Wrocław        [ PRZYJĘTE ]
======================================================================

Cześć {imie_klienta},

TWOJE BUTY SĄ U NAS.

Przyjęliśmy zlecenie. Damy znać, gdy będzie gotowe —
nie musisz nic robić.

----------------------------------------------------------------------
  ZLECENIE
  {numer_zlecenia}
----------------------------------------------------------------------

  Praca .......... {typ_pracy}
  Data odbioru ... {data_odbioru}

----------------------------------------------------------------------

Do zobaczenia,
ekipa {nazwa_warsztatu}

--
{nazwa_warsztatu}
{adres_warsztatu} · {godziny_otwarcia}
Odpisz STOP, jeśli nie chcesz dostawać powiadomień.
$txtbody$
WHERE name = 'Zlecenie przyjete (EMAIL)';

UPDATE message_template
SET body_html = $body$<!--
  ┌─────────────────────────────────────────────────────────────┐
  │ TEMPLATE: READY_FOR_PICKUP                                  │
  │ Subject:    Gotowe do odbioru · {numer_zlecenia}            │
  │ Preheader:  Twoje buty czekają. Adres i godziny w środku.   │
  │ Status:     --magenta (#ff2e7e)                             │
  │ Gesty:      accent bar + stamp "ODBIERZ"                    │
  │ CTA:        "Zobacz na mapie" → {url_warsztatu}             │
  │ Placeholders: {imie_klienta} {numer_zlecenia}               │
  │               {adres_warsztatu} {godziny_otwarcia}          │
  │               {url_warsztatu} {nazwa_warsztatu}             │
  └─────────────────────────────────────────────────────────────┘
-->
<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<title>Gotowe do odbioru · {numer_zlecenia}</title>
<style>
  @media (prefers-color-scheme: dark) {
    body, .body-bg { background:#0a0a0a !important; }
    .stage-bg { background:#161616 !important; }
    .ink-text { color:#f4efe6 !important; }
    .mute-text { color:#b8b3a5 !important; }
    .line-b { border-bottom-color:#2a2a2a !important; }
    .footer-bg { background:#161616 !important; }
    .code-card { background:#0a0a0a !important; border-color:#3a3a3a !important; }
    .stamp { background:#161616 !important; }
    .accent { background:#ff4d92 !important; }
  }
  @media only screen and (max-width:480px) {
    .px-32 { padding-left:20px !important; padding-right:20px !important; }
    .order-num { font-size:36px !important; line-height:40px !important; }
    .headline { font-size:24px !important; line-height:28px !important; }
    .wordmark { font-size:26px !important; line-height:26px !important; }
  }
</style>
</head>
<body class="body-bg" style="margin:0;padding:0;background:#ebe4d4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0a0a0a;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:transparent;opacity:0;mso-hide:all;">
Twoje buty czekają w warsztacie. Adres, godziny i mapa w środku.&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ebe4d4;">
<tr><td align="center" style="padding:24px 12px;">

<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;">

  <!-- HEADER -->
  <tr><td style="background:#0a0a0a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td class="px-32" valign="top" style="padding:24px 32px 22px;">
          <div class="wordmark" style="font-family:Impact,'Arial Black','Helvetica Inserat',sans-serif;color:#f4efe6;font-size:32px;line-height:32px;letter-spacing:.02em;text-transform:uppercase;font-weight:900;">DR.SHOES</div>
          <div style="font-family:'SF Mono','Menlo','Consolas',monospace;color:#d8ff3a;font-size:10px;line-height:14px;letter-spacing:.18em;text-transform:uppercase;margin-top:6px;">warsztat szewski · wrocław</div>
        </td>
        <td class="px-32" align="right" valign="middle" width="150" style="padding:24px 32px 22px;text-align:right;">
          <div class="stamp" style="display:inline-block;background:#0a0a0a;color:#ff2e7e;font-family:Impact,'Arial Black',sans-serif;font-size:13px;font-weight:900;letter-spacing:.16em;text-transform:uppercase;padding:5px 12px;border:2px solid #ff2e7e;">[ Odbierz ]</div>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- ACCENT BAR -->
  <tr><td class="accent" height="6" style="background:#ff2e7e;height:6px;font-size:0;line-height:0;mso-line-height-rule:exactly;">&nbsp;</td></tr>

  <!-- BODY -->
  <tr><td class="stage-bg px-32" style="background:#f4efe6;padding:36px 32px 8px;">
    <p class="mute-text" style="margin:0 0 8px;font-size:15px;line-height:22px;color:#6b6960;">Cześć {imie_klienta},</p>
    <h1 class="headline ink-text" style="margin:0 0 14px;font-family:Impact,'Arial Black',sans-serif;font-size:32px;line-height:34px;letter-spacing:-.01em;text-transform:uppercase;color:#0a0a0a;font-weight:900;">Gotowe. Wpadnij po odbiór.</h1>
    <p class="ink-text" style="margin:0 0 28px;font-size:16px;line-height:24px;color:#0a0a0a;">Twoje zlecenie czeka w warsztacie. Wpadnij, kiedy Ci pasuje — w godzinach poniżej.</p>
  </td></tr>

  <!-- ORDER CODE -->
  <tr><td class="stage-bg px-32" style="background:#f4efe6;padding:0 32px 28px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="code-card" style="border:2px solid #0a0a0a;background:#ebe4d4;">
      <tr><td style="padding:18px 22px 20px;">
        <div class="mute-text" style="font-family:'SF Mono','Menlo','Consolas',monospace;font-size:10px;line-height:14px;letter-spacing:.18em;text-transform:uppercase;color:#6b6960;margin-bottom:6px;">Zlecenie</div>
        <div class="order-num ink-text" style="font-family:Impact,'Arial Black','Helvetica Inserat',sans-serif;font-size:48px;line-height:48px;letter-spacing:-.02em;color:#0a0a0a;font-weight:900;">{numer_zlecenia}</div>
      </td></tr>
    </table>
  </td></tr>

  <!-- DETAILS -->
  <tr><td class="stage-bg px-32" style="background:#f4efe6;padding:0 32px 24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td class="line-b mute-text" width="160" valign="top" style="padding:14px 0;border-bottom:1px solid #d8d2c0;font-family:'SF Mono','Menlo','Consolas',monospace;font-size:11px;line-height:16px;letter-spacing:.14em;text-transform:uppercase;color:#6b6960;">Adres</td>
        <td class="line-b ink-text" valign="top" style="padding:14px 0;border-bottom:1px solid #d8d2c0;font-size:16px;line-height:22px;color:#0a0a0a;">{adres_warsztatu}</td>
      </tr>
      <tr>
        <td class="mute-text" width="160" valign="top" style="padding:14px 0 0;font-family:'SF Mono','Menlo','Consolas',monospace;font-size:11px;line-height:16px;letter-spacing:.14em;text-transform:uppercase;color:#6b6960;">Godziny</td>
        <td class="ink-text" valign="top" style="padding:14px 0 0;font-size:16px;line-height:22px;color:#0a0a0a;">{godziny_otwarcia}</td>
      </tr>
    </table>
  </td></tr>

  <!-- CTA -->
  <tr><td class="stage-bg px-32" style="background:#f4efe6;padding:8px 32px 40px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
      <tr><td bgcolor="#0a0a0a" style="background:#0a0a0a;border:2px solid #0a0a0a;mso-padding-alt:16px 28px;">
        <a href="{url_warsztatu}" style="display:inline-block;padding:16px 28px;color:#d8ff3a;font-family:Impact,'Arial Black','Helvetica Inserat',sans-serif;font-size:16px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;text-decoration:none;line-height:16px;">Zobacz na mapie&nbsp;&nbsp;→</a>
      </td></tr>
    </table>
  </td></tr>

  <!-- SIGN OFF -->
  <tr><td class="stage-bg px-32 ink-text" style="background:#f4efe6;padding:0 32px 40px;font-size:15px;line-height:22px;color:#0a0a0a;">
    Czekamy,<br />ekipa <strong>{nazwa_warsztatu}</strong>
  </td></tr>

  <!-- FOOTER -->
  <tr><td class="footer-bg mute-text" style="background:#ebe4d4;border-top:1px solid #d8d2c0;padding:20px 32px 24px;font-size:12px;line-height:18px;color:#6b6960;">
    <strong class="ink-text" style="color:#0a0a0a;">{nazwa_warsztatu}</strong><br />
    {adres_warsztatu} · {godziny_otwarcia}<br />
    <span style="opacity:.85;">Odpisz STOP, jeśli nie chcesz dostawać powiadomień o swoich zleceniach.</span>
  </td></tr>

</table>

</td></tr>
</table>
</body>
</html>
$body$,
    body      = $txtbody$======================================================================
  DR.SHOES — warsztat szewski, Wrocław        [ ODBIERZ ]
======================================================================

Cześć {imie_klienta},

GOTOWE. WPADNIJ PO ODBIÓR.

Twoje zlecenie czeka w warsztacie. Wpadnij, kiedy Ci pasuje —
w godzinach poniżej.

----------------------------------------------------------------------
  ZLECENIE
  {numer_zlecenia}
----------------------------------------------------------------------

  Adres ...... {adres_warsztatu}
  Godziny .... {godziny_otwarcia}

  Zobacz na mapie:
  {url_warsztatu}

----------------------------------------------------------------------

Czekamy,
ekipa {nazwa_warsztatu}

--
{nazwa_warsztatu}
{adres_warsztatu} · {godziny_otwarcia}
Odpisz STOP, jeśli nie chcesz dostawać powiadomień.
$txtbody$
WHERE name = 'Gotowe do odbioru (EMAIL)';

UPDATE message_template
SET body_html = $body$<!--
  ┌─────────────────────────────────────────────────────────────┐
  │ TEMPLATE: FEEDBACK_REQUEST                                  │
  │ Subject:    Jak chodzi w nowych? · {numer_zlecenia}         │
  │ Preheader:  3 dni z naprawionymi butami. Powiedz, jak jest. │
  │ Status:     --green (#18b06b)                               │
  │ Gesty:      accent bar (jedyny — świadome powściągnięcie)   │
  │ CTA:        "Wystaw opinię" → {url_warsztatu}               │
  │ Order code: mniejszy (28px) — kontekst rozluźniony          │
  │ Placeholders: {imie_klienta} {numer_zlecenia}               │
  │               {url_warsztatu} {nazwa_warsztatu}             │
  │               {adres_warsztatu} {godziny_otwarcia}          │
  └─────────────────────────────────────────────────────────────┘
-->
<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<title>Jak chodzi w nowych? · {numer_zlecenia}</title>
<style>
  @media (prefers-color-scheme: dark) {
    body, .body-bg { background:#0a0a0a !important; }
    .stage-bg { background:#161616 !important; }
    .ink-text { color:#f4efe6 !important; }
    .mute-text { color:#b8b3a5 !important; }
    .footer-bg { background:#161616 !important; }
    .order-row { border-color:#2a2a2a !important; }
    .accent { background:#28d088 !important; }
  }
  @media only screen and (max-width:480px) {
    .px-32 { padding-left:20px !important; padding-right:20px !important; }
    .order-num-sm { font-size:24px !important; line-height:26px !important; }
    .headline { font-size:24px !important; line-height:28px !important; }
    .wordmark { font-size:26px !important; line-height:26px !important; }
  }
</style>
</head>
<body class="body-bg" style="margin:0;padding:0;background:#ebe4d4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0a0a0a;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:transparent;opacity:0;mso-hide:all;">
Trzy dni z naprawionymi butami. Powiedz nam, jak Ci się chodzi.&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ebe4d4;">
<tr><td align="center" style="padding:24px 12px;">

<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;">

  <!-- HEADER (bez status-label — świadomy restraint dla tonu) -->
  <tr><td style="background:#0a0a0a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td class="px-32" valign="top" style="padding:24px 32px 22px;">
          <div class="wordmark" style="font-family:Impact,'Arial Black','Helvetica Inserat',sans-serif;color:#f4efe6;font-size:32px;line-height:32px;letter-spacing:.02em;text-transform:uppercase;font-weight:900;">DR.SHOES</div>
          <div style="font-family:'SF Mono','Menlo','Consolas',monospace;color:#d8ff3a;font-size:10px;line-height:14px;letter-spacing:.18em;text-transform:uppercase;margin-top:6px;">warsztat szewski · wrocław</div>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- ACCENT BAR -->
  <tr><td class="accent" height="6" style="background:#18b06b;height:6px;font-size:0;line-height:0;mso-line-height-rule:exactly;">&nbsp;</td></tr>

  <!-- BODY -->
  <tr><td class="stage-bg px-32" style="background:#f4efe6;padding:40px 32px 12px;">
    <p class="mute-text" style="margin:0 0 8px;font-size:15px;line-height:22px;color:#6b6960;">Cześć {imie_klienta},</p>
    <h1 class="headline ink-text" style="margin:0 0 16px;font-family:Impact,'Arial Black',sans-serif;font-size:32px;line-height:34px;letter-spacing:-.01em;text-transform:uppercase;color:#0a0a0a;font-weight:900;">Jak Ci się chodzi?</h1>
    <p class="ink-text" style="margin:0 0 18px;font-size:16px;line-height:24px;color:#0a0a0a;">Trzy dni temu odebrałeś buty z warsztatu. Jak chodzą? Czujesz różnicę?</p>
    <p class="ink-text" style="margin:0 0 28px;font-size:16px;line-height:24px;color:#0a0a0a;">Jedno kliknięcie, dwie minuty. Czytamy każdą opinię.</p>
  </td></tr>

  <!-- CTA -->
  <tr><td class="stage-bg px-32" style="background:#f4efe6;padding:0 32px 24px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
      <tr><td bgcolor="#0a0a0a" style="background:#0a0a0a;border:2px solid #0a0a0a;mso-padding-alt:16px 28px;">
        <a href="{url_warsztatu}" style="display:inline-block;padding:16px 28px;color:#d8ff3a;font-family:Impact,'Arial Black','Helvetica Inserat',sans-serif;font-size:16px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;text-decoration:none;line-height:16px;">Wystaw opinię&nbsp;&nbsp;→</a>
      </td></tr>
    </table>
  </td></tr>

  <!-- FALLBACK NOTE -->
  <tr><td class="stage-bg px-32 mute-text" style="background:#f4efe6;padding:0 32px 32px;font-size:14px;line-height:20px;color:#6b6960;">
    Nie chce Ci się klikać? <span class="ink-text" style="color:#0a0a0a;"><strong>Odpisz na tego maila</strong></span> — każda linijka się przyda.
  </td></tr>

  <!-- ORDER CODE — smaller, jednoliniowy -->
  <tr><td class="stage-bg px-32" style="background:#f4efe6;padding:0 32px 40px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="order-row" style="border-top:1px solid #d8d2c0;border-bottom:1px solid #d8d2c0;">
      <tr>
        <td class="mute-text" width="120" valign="middle" style="padding:14px 0;font-family:'SF Mono','Menlo','Consolas',monospace;font-size:10px;line-height:14px;letter-spacing:.18em;text-transform:uppercase;color:#6b6960;">Zlecenie</td>
        <td class="order-num-sm ink-text" valign="middle" align="right" style="padding:14px 0;font-family:Impact,'Arial Black','Helvetica Inserat',sans-serif;font-size:28px;line-height:30px;letter-spacing:-.01em;color:#0a0a0a;font-weight:900;text-align:right;">{numer_zlecenia}</td>
      </tr>
    </table>
  </td></tr>

  <!-- SIGN OFF -->
  <tr><td class="stage-bg px-32 ink-text" style="background:#f4efe6;padding:0 32px 40px;font-size:15px;line-height:22px;color:#0a0a0a;">
    Dzięki,<br />ekipa <strong>{nazwa_warsztatu}</strong>
  </td></tr>

  <!-- FOOTER -->
  <tr><td class="footer-bg mute-text" style="background:#ebe4d4;border-top:1px solid #d8d2c0;padding:20px 32px 24px;font-size:12px;line-height:18px;color:#6b6960;">
    <strong class="ink-text" style="color:#0a0a0a;">{nazwa_warsztatu}</strong><br />
    {adres_warsztatu} · {godziny_otwarcia}<br />
    <span style="opacity:.85;">Odpisz STOP, jeśli nie chcesz dostawać powiadomień o swoich zleceniach.</span>
  </td></tr>

</table>

</td></tr>
</table>
</body>
</html>
$body$,
    body      = $txtbody$======================================================================
  DR.SHOES — warsztat szewski, Wrocław
======================================================================

Cześć {imie_klienta},

JAK CI SIĘ CHODZI?

Trzy dni temu odebrałeś buty z warsztatu. Jak chodzą?
Czujesz różnicę?

Jedno kliknięcie, dwie minuty. Czytamy każdą opinię.

  Wystaw opinię:
  {url_warsztatu}

Nie chce Ci się klikać? Odpisz na tego maila — każda
linijka się przyda.

----------------------------------------------------------------------
  Zlecenie: {numer_zlecenia}
----------------------------------------------------------------------

Dzięki,
ekipa {nazwa_warsztatu}

--
{nazwa_warsztatu}
{adres_warsztatu} · {godziny_otwarcia}
Odpisz STOP, jeśli nie chcesz dostawać powiadomień.
$txtbody$
WHERE name = 'Prosba o opinie (EMAIL)';

