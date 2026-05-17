# Dr Shoes — Product Brief (canonical functional spec)

Two-layer web product for Dr Shoes (drshoes.pl, @dr_shoes) — shoe repair, custom shoe painting, custom jacket painting workshop.

## Layer 1 — Public Landing Page

Single long-scroll page with anchor nav. Sections in order:

### 1. Hero
- Full-bleed video or hero image of workshop work.
- Massive graffiti wordmark.
- One-line tagline: "customy, naprawy, malowanie — robione ręcznie".
- Sticky top nav with anchors: Aktualności / Sklep / Kontakt.
- Primary CTAs: "Zamów custom" and "Oddaj buty do naprawy" (both lead to a contact/intake form).

### 2. Services overview
Three large tiles with hover zoom: **Naprawa butów / Custom malowanie butów / Custom kurtki**. Each tile = oversized image + tagged label.

### 3. Aktualności / News
- Grid of cards (3 cols desktop, 1 col mobile).
- Each card: hero image, rubber-stamp date, title, 2-line excerpt, "czytaj" link.
- Latest post is double-width with a sprayed frame.
- Cards lift + zoom on hover.

### 4. Sklep / Shop (reservation only — no payment)
Grid of shoes for sale. Each product card:
- Large product photo (hover zoom + slight rotation, deepening shadow).
- Name, brand, size, price.
- Status badge styled as sprayed stencil: **dostępne / zarezerwowane / sprzedane**.
- Button "Zarezerwuj" → opens modal: name, phone, email, preferred pickup date, optional message.
- Required disclaimer copy under the form: **"Płatność i odbiór wyłącznie na miejscu w pracowni. Rezerwacja jest niezobowiązująca przez 48h."**
- Filter bar above grid (taped paper labels): brand, size, price range, status.

### 5. Kontakt / Contact
Two columns:
- Left: contact data (address, phone, email, opening hours, Instagram), styled as a stickered notice board.
- Right: embedded Google Map tile, framed with a sprayed border / pin.
- Below: contact form (name, email, message, optional photo upload for custom inquiries).

### 6. Footer
Social icons (IG primary), small print, repeated address, scroll-to-top spray-can button.

## Layer 2 — Admin Panel (CRM)

Full lifecycle management. Login at `/admin`. Visual style: graffiti **toned down for usability** — accents on badges/chips/active states; data tables and forms stay clean and dense.

### Global shell
Left sidebar nav: **Dashboard / Zamówienia / Kalendarz / Kanban / Klienci / Sklep / Aktualności / Wiadomości / Triggery / Ustawienia**. Top bar: search, notifications, admin avatar.

### Zamówienia (Orders) — three switchable views

**A. List view (default)**
- Dense table. Columns: ID, klient, typ zlecenia (naprawa / custom buty / custom kurtka), opis krótki, status, data przyjęcia, data planowanego odbioru, przypisany rzemieślnik, miniatura zdjęcia, akcje.
- Filter bar (collapsible, multi-select chips): status, typ, rzemieślnik, zakres dat (przyjęcia / odbioru), klient autocomplete, tag, wyszukiwarka tekstowa.
- Saved filter presets ("Pilne na ten tydzień", "Gotowe do odbioru", "Zaległe").
- Row click → order detail **drawer** slides in from the right (no navigation away).

**B. Kalendarz / Calendar view**
- Month / week / day toggle. Orders shown as colored blocks on planned pickup date. Color = status.
- Drag to reschedule. Side panel: unscheduled orders (drag onto calendar to schedule).
- Click → same detail drawer.

**C. Kanban view**
- Columns = statuses: **przyjęte → w realizacji → czeka na klienta → gotowe do odbioru → wydane**.
- Cards: thumbnail, klient, typ, due date, urgency tag.
- Drag between columns updates status. Triggers a confirmation: "Wysłać wiadomość do klienta?" with the matching trigger template pre-filled.

### Order detail drawer / page
- **Nagłówek:** ID, klient (link to client profile), status (editable dropdown), tagi, data przyjęcia/odbioru.
- **Items:** list (an order can hold multiple shoes/jackets). Each item: typ, opis pracy, before-photos, after-photos, notatki rzemieślnika, cena, czas pracy. "Dodaj item" button.
- **Photo gallery:** drag-and-drop upload, label each photo (before / w trakcie / after), reorder.
- **Notatki wewnętrzne:** chronological log, admin-only.
- **Komunikacja z klientem:** chronological thread of all sent messages (email / SMS / WhatsApp), with delivery status. "Wyślij wiadomość" → composer with template picker.
- **Akcje:** Wyślij update do klienta, Zmień status, Wystaw paragon, Oznacz jako wydane, Anuluj zlecenie.

### Klienci (Clients)
List + detail. Detail: kontakt, historia zleceń, łączna wartość, notatki, preferowany kanał kontaktu.

### Sklep (Shop admin)
CRUD for shop products. Per product: zdjęcia (multi-upload), nazwa, marka, rozmiar, cena, opis, status (dostępne/zarezerwowane/sprzedane). Lista rezerwacji per produkt z danymi kontaktowymi.

### Aktualności (News admin)
CRUD for news posts. Rich-text editor + cover image + gallery. Draft/published toggle.

### Wiadomości / Messaging
Two-pane.
- Left: conversation list with clients, unified across channels (email, SMS, WhatsApp). Filters: nieprzeczytane / wymaga odpowiedzi / wszystkie / per kanał.
- Right: thread + composer.
- Composer: channel picker (email / SMS), template picker (from triggers or manual library), attachments (incl. from order gallery), order link (autocomplete), preview before send.

### Triggery / Trigger messaging
List of automated messages. Each trigger:
- Nazwa.
- Zdarzenie: status change to X / order accepted / X days before pickup / Y days after handover (review request) / etc.
- Kanał: email / SMS / oba.
- Szablon treści with placeholders: `{imię_klienta}`, `{numer_zlecenia}`, `{typ_pracy}`, `{data_odbioru}`, `{link_do_zdjęć}`.
- On/off toggle.
- Opóźnienie (od razu / po X godzinach).
- "Wymaga ręcznego potwierdzenia?" toggle — when on, queues into a "do wysłania" inbox.
- Statystyki: wysłane, otwarte, odpowiedzi.

Plus a manual-template library (CRUD) used by the messaging composer.

### Dashboard
Tiles: zlecenia w realizacji, gotowe do odbioru, zaległe, przychód miesiąca, najnowsze rezerwacje ze sklepu, ostatnie wiadomości od klientów. Charts: zlecenia/tydzień, mix typów zleceń.

## Visual direction
Graffiti aesthetic on the landing. Toned-down accents in the admin. High-contrast palette: deep black, off-white/cream, plus 2–3 punchy accents (acid yellow, hot pink/magenta, electric blue). See `DESIGN_SYSTEM.md` for tokens.

## Language
All UI copy in **Polish**. Code/comments in English.
