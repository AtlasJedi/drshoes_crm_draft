-- M-v2-E: seed the "Dr Shoes - followup (EMAIL)" template used when operators
-- compose a free-form message to a client. The HTML wrapper provides branding;
-- the content slot {wiadomosc_tresc} is replaced at render time with the
-- operator's typed body. Body (plain-text) = passthrough for the text/plain part.

INSERT INTO message_template (id, name, channel, subject, body, body_html, active)
VALUES (
  uuid_generate_v4(),
  'Dr Shoes - followup (EMAIL)',
  'EMAIL',
  'Dr Shoes — followup',
  '{wiadomosc_tresc}',
  $html$<!doctype html>
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

  <!-- BODY -->
  <tr><td class="stage-bg" style="background:#f4efe6;padding:36px 32px 40px;">
    <div class="ink-text" style="font-size:15px;line-height:1.6;color:#0a0a0a;white-space:pre-wrap;">{wiadomosc_tresc}</div>
  </td></tr>

  <!-- FOOTER -->
  <tr><td class="mute-text" style="background:#ebe4d4;border-top:1px solid #d8d2c0;padding:20px 32px 24px;font-size:12px;line-height:18px;color:#6b6960;">
    <strong class="ink-text" style="color:#0a0a0a;">Dr Shoes</strong> · Poznań
  </td></tr>

</table>

</td></tr>
</table>
</body>
</html>$html$,
  TRUE
);
