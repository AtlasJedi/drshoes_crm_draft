# Dispatch Log — m11-email-html-regression

**Task:** email-html-regression — add regression test coverage for HTML body delivery through SMTP gateway  
**Plan section:** `docs/superpowers/plans/2026-05-16-owner-feedback-fixes.md` — Dispatch C  
**Milestone:** m11  
**UTC timestamp:** 20260516T165147Z  
**Review type:** COMBINED single-stage (pure test additions, no production code changes)

---

## Files changed

### New files

- `backend/libs/email-gateway/src/test/java/com/drshoes/lib/email/smtp/SmtpEmailGatewayTest.java`
  — Pure unit test (no Spring context, no real SMTP). Two tests:
  1. `whenBodyHtmlPresent_sentMimeMessageHasBothPlainAndHtmlParts` — mocks `JavaMailSender`, captures the `MimeMessage` via `ArgumentCaptor`, calls `saveChanges()` to finalize MIME headers, then recursively collects all leaf content-type strings; asserts both `text/plain` and `text/html` leaf parts are present when `OutboundMessage.bodyHtml` is non-null.
  2. `whenBodyHtmlAbsent_sentMimeMessageHasOnlyPlainTextPart` — same setup, asserts `text/html` is absent when `bodyHtml` is null.
  Both tests also assert From / To / Subject headers are set correctly.

- `backend/app/src/test/java/com/drshoes/app/messaging/service/MessageRouterEmailHtmlTest.java`
  — Integration test (`AbstractIntegrationTest` base, full Spring context + Testcontainers Postgres). One test:
  1. `sendManual_withGotodoOdbioru_persistsBodyHtmlNonNullAndContainsDesignerMarker` — seeds a minimal client + order via `JdbcTemplate`, calls `MessageRouter.sendManual(...)` with the "Gotowe do odbioru (EMAIL)" template (V022-seeded), then asserts the persisted `MessageEntity.bodyHtml` is non-null, length > 1000, and contains `<table role="presentation"`.

### Directories created

- `backend/libs/email-gateway/src/test/java/com/drshoes/lib/email/smtp/` (new package directory)

---

## Commands run

```
# SmtpEmailGatewayTest alone
mvn -pl libs/email-gateway test -Dtest=SmtpEmailGatewayTest -Dsurefire.failIfNoSpecifiedTests=false
# Result: 2/2 GREEN

# MessageRouterEmailHtmlTest alone
mvn -pl app test -Dtest=MessageRouterEmailHtmlTest -Dsurefire.failIfNoSpecifiedTests=false
# Result: 1/1 GREEN

# Full suite
mvn -pl app,libs/email-gateway test -Dsurefire.failIfNoSpecifiedTests=false
# Result: 469/0/0/0 BUILD SUCCESS
```

---

## Test summary

| Module         | Before | After |
|----------------|--------|-------|
| app            | 398+   | +1 new test |
| email-gateway  | existing | +2 new tests |
| **Total**      | 467    | **469 / 0 / 0 / 0** |

---

## Decisions

### MimeMessage.saveChanges() required before traversal
`MimeMessageHelper` (Spring) stores MIME structure lazily. Without calling `MimeMessage.saveChanges()`, the root message's content-type header is not yet finalized, so `Part.isMimeType("multipart/*")` returns `false` and the tree traversal sees the root as a leaf (yielding `["text/plain"]` only). The fix: call `mm.saveChanges()` at the start of `collectLeafContentTypesInto` when the `Part` is a `MimeMessage`. This is a test-only concern — the real `JavaMailSender.send(MimeMessage)` calls `saveChanges()` internally before transmitting.

### SmtpEmailGateway produces multipart/mixed → multipart/alternative → [plain, html]
`MimeMessageHelper(mime, true, "UTF-8")` sets `multipart=true` (produces `multipart/mixed` root). `h.setText(plain, html)` then wraps both alternatives in a `multipart/alternative` sub-part. The leaf-collection traversal handles this correctly by recursing into all `multipart/*` nodes.

### No production code changes
Tests passed against the existing `SmtpEmailGateway` and `MessageRouter` implementations without modification. The runtime path was already correct — V022 seeds `body_html`, `MessageRouter.send(...)` renders it via `TemplateRenderer`, `MessageGatewayDispatcher.dispatch(...)` passes it as `OutboundMessage.bodyHtml`, and `SmtpEmailGateway` correctly calls `h.setText(plain, html)` when non-null. No bugs found in production code.

### Template name used
"Gotowe do odbioru (EMAIL)" — chosen per plan specification. This template was seeded by V022 with ~7KB designer HTML. The test first asserts `template.getBodyHtml() != null && length > 1000` before calling `sendManual`, so it fails early if V022 is not applied.

---

## Review — APPROVED (combined single-stage)

- [x] Tests are `*Test.java` (Surefire-runnable), NOT `*IT.java` (Failsafe-only)
- [x] No production code modified
- [x] LOC: SmtpEmailGatewayTest 188 LOC, MessageRouterEmailHtmlTest 110 LOC — both within limits
- [x] Integration test uses `AbstractIntegrationTest` base (Testcontainers Postgres, same pattern as `MessageRouterIntegrationTest`)
- [x] `@AfterEach` cleanup in FK order matching existing patterns
- [x] No Spring context in SmtpEmailGatewayTest — pure Mockito unit test
- [x] Both new tests GREEN; full suite 469/0/0/0

---

## Commit SHA

_(to be filled after commit)_

---

## Follow-ups

- The `saveChanges()` requirement is a JavaMail implementation detail that could trip up future MIME tests. Consider adding a comment in `SmtpEmailGatewayTest` javadoc (done inline in the test).
- The Mockito JDK self-attach warning is a pre-existing infra concern (Byte Buddy agent), not introduced by this dispatch.

---

## Subagent token budget

Estimated ~18K tokens used in this session.
