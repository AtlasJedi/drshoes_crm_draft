# Plan — make client picker optional in new-order form (ad-hoc client)

**Owner ask:** *"creaign new order should have form for name, phone and email.
picking person by name from our saved list should not be mandatory"*

**Decision (owner-confirmed 2026-05-16):** auto-create a permanent Client
record via `POST /api/admin/clients` when the user submits the new-order form
without picking an existing client. This matches what `ClientCreateModal`
already does — we just lift the fields into the new-order form itself so the
user can fill them inline.

## Scope (single combined dispatch — anti-bloat dispatch rule applies)

**Files to touch:**
- `apps/web/app/(admin)/admin/orders/new/_components/NewOrderForm.tsx` (the only logic change)
- `apps/web/app/(admin)/admin/orders/new/_components/__tests__/NewOrderForm.test.tsx` (update + add cases)

**Do NOT touch:** backend, any other Order/Client form. The backend already
accepts `POST /api/admin/clients` and the existing `createClient(req)` helper
in `apps/web/lib/clients/api.ts` is ready to use.

## Behavior contract

The form now has two mutually-exclusive modes, switched by a radio /
segmented control at the top of the form:

1. **"Istniejący klient"** (existing) — default mode. Shows the current
   `<ClientPicker>`. Submit blocks if no client picked (same as today).
2. **"Nowy klient"** (new / ad-hoc) — shows three inline inputs:
   - **Imię i nazwisko** (required) — single text field. Split on first space:
     first token → `firstName`, rest → `lastName`. If the user types only one
     word, `lastName = null`.
   - **Telefon** (optional)
   - **Email** (optional)

   At least one of phone OR email must be filled (so the customer is
   reachable). Otherwise show inline validation: "Podaj telefon lub email".

   Default `rodoConsent = true` (matches `ClientCreateModal` default).

On submit in "Nowy klient" mode:

1. Call `createClient({ firstName, lastName, phone, email, rodoConsent: true })`
2. On success → use returned `client.id` as `clientId` for the order
3. Call `createOrder(req)` exactly as today with `clientId: created.id`
4. On `createClient` error → show inline error, do NOT create the order

Existing-client mode submit path is unchanged.

## Acceptance criteria

- The form renders the mode switcher with "Istniejący klient" selected by default.
- Switching to "Nowy klient" hides `<ClientPicker>` and shows the 3 inputs.
- Switching back restores the picker (and clears the inline-form state, OR
  preserves it — either is fine, pick whichever is simpler).
- In "Nowy klient" mode with empty name → submit blocked with
  "Podaj imię i nazwisko".
- In "Nowy klient" mode with name but no phone AND no email → submit blocked
  with "Podaj telefon lub email".
- Successful "Nowy klient" submit calls `createClient` exactly once, then
  `createOrder` exactly once, then `router.push` to the new order detail (same
  as existing flow).
- Tests cover: existing-client happy path (unchanged), ad-hoc happy path,
  ad-hoc validation errors (missing name, missing phone+email), `createClient`
  failure leaves the form usable (no order created).
- All vitest in `apps/web` must remain green: `pnpm -C apps/web test` returns
  zero failures.

## Notes for the implementer

- Use the same input classes (`inputCls`, `labelCls`) the form already
  defines — visual consistency is part of the deal.
- Polish copy only in the UI. Code/comments in English.
- Use `createLogger("new-order-form")` (already imported) for structured logs:
  `op=adhoc-client-create attempt|outcome=ok|outcome=error`.
- Don't add a separate `<NewClientFields>` component — inline JSX inside the
  same form is fine and shorter. Anti-bloat: < 80 LOC of new code total.
- The phone/email regex validation already lives in `ClientCreateModal` if
  you want to copy it. Or just trust the backend `@Size` — frontend only
  needs the "at-least-one" rule.

## Dispatch log

Write `docs/dispatch-log/m11-adhoc-client-<UTC>.md` with: files touched,
commands run, test summary line, commit SHA, any decisions deviating from
this plan.
