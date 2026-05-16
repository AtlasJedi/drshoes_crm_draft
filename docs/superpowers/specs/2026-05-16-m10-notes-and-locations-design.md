# Milestone 10 — Wave 1: Custom Notes + Storage Locations

**Status:** spec written 2026-05-16 — awaiting owner review
**Owner directive:** "to ma być prosty CRM, stop overthinking"
**Trigger:** owner request 2026-05-16 (screenshot + 3-paragraph ask). First M10 wave.

---

## 1. Goal

Pozwolić pracownikowi pracowni dodawać wolne wpisy do historii zlecenia (notatki bez zmiany statusu) i przenosić zlecenie między fizycznymi miejscami warsztatu (półka, suszarka, szuflada). Miejsca są zarządzane przez admina jako prosty zbiór nazw.

### W scope

- Tabela `storage_location` (prosty zbiór string-ów zarządzany przez admina).
- Kolumna `orders.location VARCHAR(64) NULL` — plain string, bez FK.
- Endpoint `POST /api/admin/orders/{orderId}/notes` — dodaje wpis do historii (notatka + opcjonalna zmiana lokacji ALBO sama zmiana lokacji).
- Endpointy CRUD dla `storage_location`.
- Panel admin `/admin/settings/miejsca`.
- Composer notatki w `OrderDrawer` (textarea + select miejsca + przycisk „dodaj wpis").
- Rozszerzenie `OrderDrawerNotes` o wpisy typu `ORDER_NOTE` z chip-em ruchu lokacji.
- Pill aktualnej lokacji w `OrderDrawerHeader`.

### Out of scope (deferred, do późniejszego M10 wave)

- Kolumna „miejsce" w widoku listy `/admin/orders`.
- Bulk move (zaznacz N zleceń → przenieś jednym kliknięciem).
- Drag-drop wizualne przesuwanie między lokacjami.
- Filter zamówień po lokacji w toolbar-ze.
- Rename-propagation (zmiana nazwy lokacji NIE aktualizuje istniejących `orders.location` — design celowy).

### Non-goal (nigdy)

- FK constraint między `orders.location` a `storage_location.name`. Zlecenie zachowuje historyczną wartość nawet jeśli lokację usunięto/zmieniono. Pracownik świadomie może wybrać nową lokację w composerze.

---

## 2. Data model

### 2.1 Nowa tabela `storage_location` — V018

```sql
CREATE TABLE storage_location (
  id          BIGSERIAL PRIMARY KEY,
  name        VARCHAR(64) NOT NULL UNIQUE,
  position    INTEGER     NOT NULL DEFAULT 0,
  active      BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_storage_location_active_position
  ON storage_location (active, position);
```

- `id` jest wewnętrzne — używane do PATCH/DELETE. UI nie pokazuje go.
- `name` jest UNIQUE — admin nie może mieć dwóch „półka 1".
- `position` — ręczna kolejność w pickerze. Update przez PATCH.
- `active` — soft-delete. Nieaktywne nie pojawiają się w pickerze, ale istniejące zlecenia zachowują tę nazwę w `orders.location`.

Seed danych: pusty (admin sam dodaje na produkcji). W testach mogą być przykładowe wartości.

### 2.2 Nowa kolumna `orders.location` — V019

```sql
ALTER TABLE orders ADD COLUMN location VARCHAR(64) NULL;
```

- NULL = lokacja nieokreślona (większość historycznych zleceń).
- Plain string — denormalizowana kopia `storage_location.name`. Brak FK celowy (rename nie propaguje, deactivate nie zeruje istniejących wartości).
- Walidacja zapisu: gdy endpoint dostaje `location` w body, backend **wymusza** żeby wartość istniała w `storage_location WHERE active = true` (zwraca 409 jeśli nie). Brak ad-hoc free-text lokacji. To celowy guardrail przeciw literówkom; admin musi najpierw dodać lokację w panelu.

### 2.3 Audit log — nowa akcja `ORDER_NOTE`

Wykorzystujemy istniejącą tabelę `audit_log` (nic nie migrujemy):

| pole | wartość dla ORDER_NOTE |
|---|---|
| `action` | `'ORDER_NOTE'` (string, dotąd istniały STATUS_CHANGED, ORDER_UPDATED, etc.) |
| `entity_type` | `'order'` |
| `entity_id` | `null` (po pattern z STATUS_CHANGED — patrz M1) |
| `parent_entity_id` | `orderId` |
| `actor_email` | z `AdminPrincipal` |
| `path` | `POST /api/admin/orders/{orderId}/notes` |
| `note` | treść notatki (TEXT, może być NULL gdy wpis to czysty move) |
| `diff` | `{"location": {"old": "półka 1", "new": "suszarka"}}` JSONB gdy lokacja się zmieniła, w innym wypadku NULL |
| `created_at` | NOW() |
| `trace_id` | z OTel context (M8 V014) |

`OrderDrawerNotes` filtruje audit rows: dotąd `WHERE action='STATUS_CHANGED' AND note IS NOT NULL`. Po M10: rozszerzone do `WHERE action IN ('STATUS_CHANGED','ORDER_NOTE') AND (note IS NOT NULL OR diff->>'location' IS NOT NULL)`.

---

## 3. Backend API

Wszystkie endpointy pod `/api/admin/*`, wymagają `@AuthenticationPrincipal AdminPrincipal`, opakowane `@Audited(...)` z istniejącego aspect-a M1.

### 3.1 Storage locations CRUD

```
GET    /api/admin/storage-locations
       → 200 [{ id, name, position, active }]   ← aktywne, posortowane po position
       Query: ?includeInactive=true → wszystkie

POST   /api/admin/storage-locations
       Body: { name: "półka 1" }
       → 201 { id, name, position, active }
       409 jeśli name już istnieje

PATCH  /api/admin/storage-locations/{id}
       Body: { name?, position?, active? }     ← częściowy update
       → 200 { id, name, position, active }
       404 jeśli brak
       409 jeśli rename na istniejącą nazwę

DELETE /api/admin/storage-locations/{id}
       → 204 (soft-delete: SET active=false, NIE usuwa wiersza)
```

`@Audited` action mapping: `STORAGE_LOCATION_CREATED`, `STORAGE_LOCATION_UPDATED`, `STORAGE_LOCATION_DEACTIVATED`. Audit-log mało interesujący dla tego entity, ale konsekwentnie audytujemy wszystko (per design principles).

### 3.2 Order note + move

```
POST   /api/admin/orders/{orderId}/notes
       Body: { note?: string (max 1000), location?: string (max 64) }
       Validation:
         - co najmniej jedno z (note, location) musi być obecne i niepuste
         - jeśli `location` podane: MUSI istnieć w storage_location WHERE active=true
         - note.trim().length > 0 albo location różne od orders.location (no-op rejected)
       → 201 { auditEntryId, note, locationChange?: {old, new}, createdAt }
       400 jeśli walidacja fails
       404 jeśli orderId brak
       409 jeśli location nie jest w aktywnym zbiorze
       
       Side-effects (jeden transactional):
         1. INSERT audit_log row (action=ORDER_NOTE, note, diff)
         2. UPDATE orders SET location = :newLocation WHERE id = :orderId
            (tylko gdy location się zmieniła)
```

**Granularność commitów backend (per dispatch-protocol clause #6):**
- StorageLocation entity + repo + service (≤ 120 LOC każdy)
- StorageLocationController (≤ 120 LOC)
- Nowy `OrderNotesController` (≤ 120 LOC) — osobny od `OrderController` dla granularności i czystego scope-u audit-aspect-a
- Audit aspect: brak zmian, używa istniejących mechanizmów

---

## 4. Frontend

### 4.1 Nowy panel `/admin/settings/miejsca`

Route: `apps/web/app/(admin)/admin/settings/miejsca/page.tsx`.

Struktura strony:
- `usePageHeader({ title: 'Miejsca', subtitle: 'gdzie leżą zlecenia w pracowni' })`
- Layout: lista po lewej (z drag-handle do reorderu), form add-new po prawej / na górze
- Każdy item w liście: nazwa + pos + edit-button + deactivate-button (toggle ikoną)
- Inactive items na końcu listy, wyszarzone

Komponenty (każdy ≤ 80 LOC):
- `page.tsx` — Server Component, fetch lokacji, render
- `_components/LocationsList.tsx` — Client Component, lista + reorder
- `_components/LocationFormModal.tsx` — modal add/edit (Radix Dialog jak ClientFormModal)
- `_components/LocationDeactivateButton.tsx` — confirm + DELETE

Sidebar nav: nowa sekcja `KONFIGURACJA` z linkiem „Miejsca". Dodajemy do `apps/web/components/admin/AdminSidebarNav.tsx`.

### 4.2 Drawer composer

Nowy komponent `apps/web/app/(admin)/admin/orders/_components/OrderDrawerNoteComposer.tsx` (≤ 80 LOC):

```
┌──────────────────────────────────────┐
│  Dodaj wpis do historii              │
│  ┌────────────────────────────────┐  │
│  │ co się stało? (opcjonalne)     │  │  ← textarea
│  └────────────────────────────────┘  │
│  Miejsce: [ aktualne ▾ ]   [ dodaj ] │  ← select + submit
└──────────────────────────────────────┘
```

Walidacja client-side: button `dodaj` aktywny gdy `(note.trim() || locationSelect !== currentLocation)`.

Pozycja w drawer (per `OrderDrawer.tsx`): bezpośrednio nad `OrderDrawerNotes`.

### 4.3 `OrderDrawerNotes` rozszerzenie

Istniejący `OrderDrawerNotes` (M9 9-25) renderuje sticky-note style dla `STATUS_CHANGED + note`. Zmiana: rozszerzenie filtru aby brał też `ORDER_NOTE` rows.

Nowy chip pod treścią notatki gdy `diff.location` istnieje:
```
📍 półka 1 → suszarka
```

Komponent zostaje, dodajemy mały sub-komponent `_LocationMoveChip.tsx` (≤ 40 LOC).

### 4.4 `OrderDrawerHeader` — current location pill

Nad albo obok status-pill: mała pill `📍 suszarka` gdy `order.location` ustawione. Click → focus na composer (scroll + focus textarea).

### 4.5 Lib + types

- `apps/web/lib/locations.ts` — fetch helpers (`listLocations`, `createLocation`, `updateLocation`, `deactivateLocation`, `addOrderNote`)
- `apps/web/lib/types.ts` — `StorageLocation`, `AddOrderNotePayload`
- Logging: każdy nowy moduł używa `lib/log.ts` named-logger pattern

---

## 5. Visual design — owner provides

Per project rule (memory: `feedback_no_layout_invention`): **nie wymyślam layoutu**.

Po akceptacji speca napiszę prompt do Claude.ai design tool dla:

1. **Panel `/admin/settings/miejsca`** — lista + add/edit form. Spójny z resztą admin (graffiti tokens, .tbl style, AdminCard, btn-clean).
2. **`OrderDrawerNoteComposer`** — sekcja w drawer. Textarea + select + button. Spójny z polish drawer'a po M9.
3. **Wpis w historii z move-chip** — extension sticky-note look (M9 9-25) z chip-em ruchu lokacji.
4. **`OrderDrawerHeader` location pill** — placement względem istniejącego status pill.
5. **Sidebar — sekcja KONFIGURACJA** — nowy nagłówek + link „Miejsca".

Implementacja frontend (Wave 2 + Wave 3 planu) **czeka** aż owner dostarczy 5 exportów. Backend (Wave 1) idzie bez czekania — UI nie blokuje schemy.

---

## 6. Migracje + testy

### 6.1 Migracje

- **V018** `__storage_location.sql` — tworzy tabelę + index.
- **V019** `__orders_location.sql` — `ALTER TABLE orders ADD COLUMN location VARCHAR(64) NULL`.

Brak danych do seedowania (admin sam doda na proda). Test fixtures w `AdminWebTestBase` MOGĄ pre-seedować 2-3 lokacje.

### 6.2 Backend testy

- `StorageLocationRepositoryTest` — JPA slice
- `StorageLocationServiceTest` — Mockito unit
- `StorageLocationControllerIntegrationTest` — `@SpringBootTest` + MockMvc — pełen CRUD, conflict 409, soft-delete behavior
- `OrderNoteEndpointIntegrationTest` — POST /api/admin/orders/{orderId}/notes — happy path, validation errors (oba puste / location not active), audit row created, orders.location updated

**Suffix `*IntegrationTest.java`** — NIE `*IT.java` (M3 hygiene fact: failsafe pluginManagement-only).

### 6.3 Frontend testy

- `LocationsList.test.tsx` — vitest snapshot + interaction
- `LocationFormModal.test.tsx` — submit happy path, conflict toast
- `OrderDrawerNoteComposer.test.tsx` — button-active rules + submit
- `OrderDrawerNotes.test.tsx` rozszerzenie — render ORDER_NOTE row z move chip
- Snapshot dla `_LocationMoveChip.tsx`

### 6.4 Acceptance

- Backend suite GREEN (target: 409 → ~430 after wave 1).
- Frontend vitest GREEN (target: 521 → ~535 after waves 2+3).
- Manualny smoke: admin doda 3 lokacje, zlecenie dostanie notatkę + move, history pokaże oba wpisy chronologicznie.

---

## 7. Risks + edge cases

| Ryzyko | Mitygacja |
|---|---|
| Admin zmienia nazwę lokacji → zlecenia mają stary string | Świadomy design (per locked decyzja owner: rename NIE propaguje wstecz). Inactive list w panelu pomoże znaleźć stare nazwy. |
| Admin deactywuje lokację → zlecenia tam się „gubią" | Pole `orders.location` zostaje, pill w drawer dalej pokazuje starą nazwę, picker nie pokaże tej opcji. Pracownik świadomie wybiera nową. |
| Konkurentny update tej samej notatki | Notatki to tylko INSERT (audit) + UPDATE (orders.location). Brak edycji istniejących notatek = brak race-conditions. |
| Spam notatek — pracownik dodaje 50 pustych wpisów | Walidacja „co najmniej jedno z dwóch" + `note.length > 0` chroni. UI rate-limit nie potrzebny (low traffic warsztat). |
| Audit-log rośnie | OK — to design choice projektu od M1. Histori jest source-of-truth. |
| Frontend pyta o listę miejsc często | Cache w Server Component / SWR jeśli potrzeba. Na razie zwykły fetch — to mały endpoint. |

---

## 8. Wave breakdown — dla `writing-plans`

Trzy wave'y, ~12 tasków łącznie.

### Wave 1 — Backend (6 tasków, niezależne od UI / wizualnego designu)

- 10-1: V018 migration + StorageLocation entity + repo
- 10-2: StorageLocationService + walidacja unique-name
- 10-3: StorageLocationController + CRUD endpoints + IT
- 10-4: V019 migration + Order.location field + Order JPA mapping update
- 10-5: OrderNotesController (POST /notes) + walidacja + audit + IT
- 10-6: Frontend lib `lib/locations.ts` + types (cienkie, ale skoro frontend będzie czekał na design — to wcześnie żeby było gotowe)

**Pauza: owner dostarcza 5 visual exports.**

### Wave 2 — Frontend admin panel (3 taski)

- 10-7: route + page.tsx + LocationsList
- 10-8: LocationFormModal (add/edit) + deactivate flow
- 10-9: AdminSidebarNav extension (KONFIGURACJA section)

### Wave 3 — Frontend drawer integration (3 taski)

- 10-10: OrderDrawerNoteComposer
- 10-11: OrderDrawerNotes ORDER_NOTE filter + _LocationMoveChip
- 10-12: OrderDrawerHeader location pill

---

## 9. Resume from a fresh session

After `/clear`, paste:

```
Read docs/superpowers/specs/2026-05-16-m10-notes-and-locations-design.md.
Then read docs/superpowers/plans/2026-05-16-m10-notes-and-locations.md (gdy powstanie).
Verify HEAD with git log --oneline -1.
Confirm task status:
  python3 -c "import json;d=json.load(open('docs/dispatch-log/tasks.json'));[print(t['id'],t['status']) for t in d['tasks'] if t['id'].startswith('10-')]"
Then dispatch the next pending 10-N task per the dispatch template.
```
