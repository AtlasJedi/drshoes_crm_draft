# Production email setup

## Current state

The app ships with `LoggingEmailGateway` (provider `NOOP` / logging). It writes
`MESSAGE_SENT` audit rows and logs bodies to stdout without making any network
call. This is the default in all environments until production email is wired.

## What is already wired

`PostmarkEmailGateway` exists in `libs/email-gateway/` and is activated by
setting `drshoes.email.provider=POSTMARK` plus the `POSTMARK_API_TOKEN` env var.
No code changes needed — only configuration.

## Steps to enable real outbound email

1. **DNS records on the client's domain** — add SPF (`TXT`), DKIM (`TXT`), and
   optionally DMARC records as instructed by the chosen ESP.
2. **Sender address** — use an address on the client's domain, e.g.
   `warzylatnie@drshoes.pl`. Never send from a free webmail domain (Gmail,
   Outlook) — deliverability will be poor.
3. **Postmark** (already integrated):
   - Create a Postmark account and add the sender domain.
   - Set `drshoes.email.provider=POSTMARK` and `POSTMARK_API_TOKEN=<token>` in
     the container environment (`.env` or Cloudflare Containers secrets).
4. **Alternative: SMTP** — a `SmtpEmailGateway` implementation does not yet
   exist. If Postmark is not desired, add an SMTP implementation using
   `spring-boot-starter-mail` and activate it with `drshoes.email.provider=SMTP`.

## Deferred items

- SMTP gateway implementation (`SmtpEmailGateway`) — no calendar slot.
- From-address configuration UI in the admin panel.
- Bounce / complaint webhook handling.
