# Wdrożenie u klienta — Dr Shoes

Krótka instrukcja uruchomienia projektu lokalnie u klienta na Dockerze + lista zmiennych do uzupełnienia.

Status: **Pierwsza wersja produkcyjna**. Stack uruchamia się w 100% z `docker compose` — nie wymaga klastrów ani Kubernetesa.

---

## 1. Wymagania na maszynie klienta

| Komponent | Wersja | Po co |
|---|---|---|
| Docker Engine | ≥ 24 | runtime kontenerów |
| Docker Compose plugin | ≥ 2.20 | orkiestracja `docker compose up` |
| 4 GB RAM | min. | Postgres + Spring Boot + Next.js + Jaeger jednocześnie |
| 10 GB miejsca | min. | obrazy + wolumeny DB + zdjęcia zleceń (MinIO) |
| Otwarte porty | 3000 (web), 8080 (API), 5432 (DB — tylko lokalnie) | dostęp z przeglądarki |

Pierwsze uruchomienie pobiera ~1.5 GB obrazów — kolejne są instant.

---

## 2. Plik `.env` — co trzeba uzupełnić przed pierwszym `up`

Skopiuj `.env.example` do `.env` i wypełnij. Sekcje **WYMAGANE w produkcji** zaznaczone ⚑, **opcjonalne** ⊙.

### ⚑ Postgres (baza)
```bash
POSTGRES_USER=drshoes
POSTGRES_PASSWORD=<wygeneruj losowo, min. 24 znaki>   # ⚑ zmienić z dev-secret
POSTGRES_DB=drshoes
POSTGRES_PORT=5432
```

### ⚑ MinIO (lokalne object-storage na zdjęcia)
```bash
MINIO_ROOT_USER=drshoes
MINIO_ROOT_PASSWORD=<wygeneruj losowo>                # ⚑ zmienić z dev-secret
MINIO_BUCKET=drshoes-prod                              # ⊙ wolno zostawić drshoes-dev
MINIO_API_PORT=9000
MINIO_CONSOLE_PORT=9001
```

### ⚑ Backend + Web
```bash
BACKEND_PORT=8080
SPRING_PROFILES_ACTIVE=local        # ⚑ na razie zostaw "local" (jedyny działający profil)
WEB_PORT=3000
NEXT_PUBLIC_API_BASE=/api
```

### ⊙ OpenTelemetry / Jaeger (tracing — można wyłączyć)
```bash
JAEGER_OTLP_HTTP_PORT=4318
JAEGER_UI_PORT=16686
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```
Jeśli klient nie chce traces — wystarczy nie pushować profilu OTel; backend pójdzie bez Jaegera.

### ⚑ Wyłączenie seedu testowych danych
```bash
DRSHOES_DEMO_SEED_ENABLED=false      # ⚑ koniecznie false w produkcji
```

### ⚑ Identyfikacja warsztatu (placeholdery w mailach)
```bash
DRSHOES_WORKSHOP_NAME=Dr Shoes
DRSHOES_WORKSHOP_ADDRESS=Aleje Karola Marcinkowskiego 26, 61-745 Poznań
DRSHOES_WORKSHOP_OPENING_HOURS=pon–pt 10:00–18:00 · sob 11:00–15:00
DRSHOES_WORKSHOP_URL=https://drshoes.pl
```
Wartości trafiają do treści maili wysyłanych do klientów (np. „przyjąłem buty", „gotowe do odbioru").

### ⚑ Outbound email — wybierz **ścieżkę A** lub **B** poniżej

---

## 3. Konfiguracja maila — dwie ścieżki

Klient otrzymuje maile transakcyjne (przyjęcie zlecenia, gotowe do odbioru, itp.) z konta warsztatu. Backend Spring Boot wysyła przez standardowy `JavaMailSender` po SMTP. Możesz puścić to przez **(A) Gmail** albo **(B) własną domenę drshoes.pl**.

### ⓐ Ścieżka A — Gmail (najszybsze, ~15 minut)

Najprostsze, dobre na start. Z konta `<np. warsztat.drshoes@gmail.com>` lub osobistego.

**Limity Gmail:**
- konto osobiste: **500 maili/dobę**
- Google Workspace: **2 000 maili/dobę**
- pojedynczy mail max ~25 MB

#### Krok po kroku

1. **Wybierz konto Gmail które będzie wysyłać maile.** Może być nowe (`warsztat.drshoes@gmail.com`) lub istniejące właściciela warsztatu.

2. **Włącz uwierzytelnianie dwuetapowe** (App Passwords wymaga 2FA):
   - Wejdź: https://myaccount.google.com/security
   - Sekcja „Logowanie się w Google" → „Weryfikacja dwuetapowa" → **Włącz**

3. **Wygeneruj App Password (hasło aplikacji):**
   - Wejdź: https://myaccount.google.com/apppasswords
   - Nazwa aplikacji: `Dr Shoes Backend`
   - Skopiuj wygenerowane 16-znakowe hasło (format: `xxxx xxxx xxxx xxxx`)
   - **Zapisz natychmiast** — Google pokaże je tylko raz

4. **Wypełnij `.env`:**
   ```bash
   MESSAGING_EMAIL_PROVIDER=smtp
   MESSAGING_EMAIL_SMTP_FROM=warsztat.drshoes@gmail.com     # ten sam co USERNAME poniżej
   MESSAGING_EMAIL_SMTP_FROM_NAME=Dr Shoes
   SPRING_MAIL_HOST=smtp.gmail.com
   SPRING_MAIL_PORT=465
   SPRING_MAIL_USERNAME=warsztat.drshoes@gmail.com
   SPRING_MAIL_PASSWORD=xxxx xxxx xxxx xxxx                  # App Password ze spacjami OK
   ```

5. **Ważne ograniczenie Gmaila:**
   - `MESSAGING_EMAIL_SMTP_FROM` **musi być identyczny** z `SPRING_MAIL_USERNAME`. Gmail przepisuje pole `From:` na adres właściciela skrzynki — nie da się wysłać „z" innego adresu bez Google Workspace + DMARC.
   - Jeśli klient chce widzieć `warsztat@drshoes.pl` w polu nadawcy → ścieżka B.

6. **Test po starcie kontenerów** (sekcja 5 poniżej): utwórz testowe zlecenie z własnym mailem klienta → trigger powinien strzelić; sprawdź skrzynkę odbiorczą.

#### Troubleshooting Gmail

| Symptom | Przyczyna | Fix |
|---|---|---|
| `535-5.7.8 Username and Password not accepted` | używasz hasła konta, nie App Password | wygeneruj App Password ponownie |
| `Daily user sending quota exceeded` | przekroczony limit | poczekaj 24h albo Workspace |
| Maile w spamie u odbiorcy | brak SPF/DKIM dla domeny `gmail.com` od własnego konta | naturalna konsekwencja Gmaila bez Workspace; albo Workspace, albo ścieżka B |

---

### ⓑ Ścieżka B — Własna domena `drshoes.pl` (właściwa produkcja)

Lepsze deliverability, profesjonalny adres nadawcy (`warsztat@drshoes.pl`), brak limitów Gmaila. Wymaga **(1) zarejestrowanej domeny** i **(2) dostawcy SMTP**.

**3 opcje dostawcy** — wybierz jedną:

#### B1) Google Workspace + Gmail SMTP

Najprostsza dla klienta przyzwyczajonego do Gmaila — UI/UX identyczne, ale konto pod własną domeną.

- **Koszt:** $6/miesiąc/użytkownik (Business Starter) lub równoważnik w PLN, ~30 zł/mc
- **Setup:** https://workspace.google.com/ → załóż konto → konfigurator DNS Google (SPF/DKIM/MX records) podpina automatycznie.
- **Konfiguracja `.env`** — identyczna jak ścieżka A, tylko inne username/from:
  ```bash
  MESSAGING_EMAIL_PROVIDER=smtp
  MESSAGING_EMAIL_SMTP_FROM=warsztat@drshoes.pl
  MESSAGING_EMAIL_SMTP_FROM_NAME=Dr Shoes
  SPRING_MAIL_HOST=smtp.gmail.com
  SPRING_MAIL_PORT=465
  SPRING_MAIL_USERNAME=warsztat@drshoes.pl
  SPRING_MAIL_PASSWORD=<App Password z Workspace>
  ```
- **Limity:** 2 000 maili/dobę. Dla warsztatu robiącego 20-50 zleceń/dobę — z górką.

#### B2) Resend / Postmark / Mailgun (transactional service)

Profesjonalny stack — najlepsze deliverability, dashboard z statystykami, webhooki bounce, dedykowane do maila transakcyjnego.

**Polecany dla docelowej produkcji.** Najbardziej przyjazny dla deweloperów: **Resend** (https://resend.com).

- **Koszt Resend:** darmowe 3 000 maili/mc + jedna własna domena. Pro $20/mc = 50k maili.
- **Setup (Resend, przykład):**
  1. Załóż konto na https://resend.com
  2. Dodaj domenę `drshoes.pl` → Resend pokaże 3 rekordy DNS:
     - SPF: `TXT @ "v=spf1 include:_spf.resend.com ~all"`
     - DKIM: `TXT resend._domainkey "..."`
     - DMARC: `TXT _dmarc "v=DMARC1; p=quarantine; rua=mailto:dmarc@drshoes.pl"`
  3. Dodaj rekordy w panelu rejestratora domeny (`OVH`, `home.pl`, `nazwa.pl` itp.)
  4. Poczekaj 5-30 min na propagację → kliknij **Verify** w Resend
  5. W Resend → API Keys → wygeneruj klucz API
- **Konfiguracja `.env`:**
  ```bash
  MESSAGING_EMAIL_PROVIDER=smtp
  MESSAGING_EMAIL_SMTP_FROM=warsztat@drshoes.pl
  MESSAGING_EMAIL_SMTP_FROM_NAME=Dr Shoes
  SPRING_MAIL_HOST=smtp.resend.com
  SPRING_MAIL_PORT=587
  SPRING_MAIL_USERNAME=resend          # dosłownie "resend"
  SPRING_MAIL_PASSWORD=re_xxxxxxxxx    # klucz API ze stronie Resend
  ```
- **Alternatywy o podobnym setupie:**
  - **Postmark** — https://postmarkapp.com, $15/mc / 10k maili
  - **Mailgun** — https://mailgun.com, darmowe 100 maili/dobę
  - **SendGrid** — $19.95/mc, najbardziej corporate
  - **AWS SES** — $0.10 / 1k maili, najtaniej, najbardziej wymagająca konfiguracja (musisz wyjść z sandboxa)

#### B3) Self-hosted Postfix (NIE polecam)

Możliwe ale **odradzam** dla warsztatu. Wymaga:
- Statycznego IP z reverse-DNS
- SPF/DKIM/DMARC ręcznie
- Monitoring blacklist (RBL)
- Codzienne łatanie deliverability
Jedyny use-case: bardzo specyficzne wymogi compliance.

---

## 4. Zmienne — szybka ściąga „co wypełnić na produkcji"

```bash
# DB — losowe hasło ≥ 24 znaki
POSTGRES_PASSWORD=

# MinIO — losowe hasło ≥ 24 znaki
MINIO_ROOT_PASSWORD=

# Seed danych w produkcji: WYŁĄCZONY
DRSHOES_DEMO_SEED_ENABLED=false

# Tożsamość warsztatu w treści maili
DRSHOES_WORKSHOP_NAME=
DRSHOES_WORKSHOP_ADDRESS=
DRSHOES_WORKSHOP_OPENING_HOURS=
DRSHOES_WORKSHOP_URL=

# Email — wybierz ścieżkę (sekcja 3)
MESSAGING_EMAIL_PROVIDER=smtp
MESSAGING_EMAIL_SMTP_FROM=
MESSAGING_EMAIL_SMTP_FROM_NAME=
SPRING_MAIL_HOST=
SPRING_MAIL_PORT=
SPRING_MAIL_USERNAME=
SPRING_MAIL_PASSWORD=
```

Wszystkie pozostałe (POSTGRES_USER, POSTGRES_DB, MINIO_*_PORT, BACKEND_PORT, WEB_PORT, NEXT_PUBLIC_API_BASE, OTEL_*) — domyślne z `.env.example` są OK.

---

## 5. Pierwsze uruchomienie

```bash
cd misza_madafaka
cp .env.example .env
nano .env                          # wypełnij sekcję maila + hasła
docker compose up -d --build       # pierwsze uruchomienie: build + start
```

Stack zacznie się podnosić w kolejności: `postgres` → `minio` → `backend` (Flyway sam zaaplikuje migracje) → `web`. Po ~60-90 sekundach:

- **Panel admina:** http://localhost:3000/admin/login
- **API healthcheck:** http://localhost:8080/actuator/health
- **MinIO console:** http://localhost:9001 (login: `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD`)
- **Jaeger UI (opcjonalnie):** http://localhost:16686

### Pierwsze logowanie

Po pierwszym starcie konto admina trzeba utworzyć ręcznie (seed jest wyłączony w prod). Najprostsze:

```bash
docker compose exec postgres psql -U drshoes -d drshoes <<'SQL'
INSERT INTO user_ (id, email, password_hash, role, full_name, created_at)
VALUES (
  gen_random_uuid(),
  'admin@drshoes.pl',
  -- bcrypt hash dla 'CHANGE_ME_NOW' — wygeneruj nowy: https://bcrypt-generator.com
  '$2a$10$8K1p/a7yJ4Y6Q0p5P5p5P.5p5P5p5P5p5P5p5P5p5P5p5P5p5P5p',
  'OWNER',
  'Właściciel warsztatu',
  NOW()
);
SQL
```

**Lepiej:** w przyszłej wersji dodać CLI `./mvnw drshoes:create-admin` — TODO.

### Test maila po starcie

1. Zaloguj się na admin@drshoes.pl
2. **Klienci** → Dodaj klienta z **swoim własnym** mailem
3. **Zamówienia** → Nowe zlecenie dla tego klienta, status „Przyjęte"
4. Status → „Gotowe do odbioru" (triggeruje mail)
5. Sprawdź swoją skrzynkę — powinien przyjść mail z adresem warsztatu w polu `From:`

Jeśli mail NIE przyszedł — sprawdź logi:
```bash
docker compose logs backend | grep -i "mail\|smtp\|email"
```

---

## 6. Stan bazy danych — co wyczyszczone, co zostało

**Sesja deployment-prep (UTC 2026-05-17):** seedowe dane testowe zostały usunięte. W bazie pozostały:

| Tabela | Stan | Komentarz |
|---|---|---|
| `user_` | 3 wpisy | konta admin/owner testowe — **przed deployment u klienta zastąp własnymi** |
| `trigger_` | 4 wpisy | reguły wysyłki maili (np. „status=GOTOWE → wyślij szablon X") — zostaw |
| `message_template` | 5 wpisów | szablony maili PL — zostaw |
| `flyway_schema_history` | aktywna | NIE TYKAJ — Flyway zarządza migracjami |
| **Wyczyszczone:** `client`, `order_`, `order_item`, `order_event`, `storage_location`, `message`, `message_thread`, `scheduled_message`, `audit_log`, `internal_note`, `photo`, `reservation`, `webhook_event`, `idempotency_key`, `trigger_fire`, `saved_filter` | 0 wpisów | gotowe na produkcyjne dane |
| `order_code_counter` | zresetowany | następne zlecenie zacznie od `DR-2026-0001` |

Jeśli klient chce mieć przykładowe statusy/triggery od zera — zastąp `trigger_` i `message_template` własną konfiguracją w UI (Triggery + Szablony wiadomości).

---

## 7. Backup i restore (na produkcji)

Postgres trzyma dane w wolumenie `misza_madafaka_postgres_data`. Backup:

```bash
# Backup co noc do pliku
docker compose exec -T postgres pg_dump -U drshoes drshoes | gzip > backup-$(date +%F).sql.gz

# Restore
gunzip < backup-2026-05-17.sql.gz | docker compose exec -T postgres psql -U drshoes -d drshoes
```

MinIO (zdjęcia zleceń): wolumen `misza_madafaka_minio_data` — kopiuj cały katalog lub `mc mirror` na zewnętrzne S3.

---

## 8. Aktualizacje aplikacji

Gdy będzie nowa wersja na GitHubie:
```bash
cd misza_madafaka
git pull origin main
docker compose build backend web   # przebuduj
docker compose up -d                # restart
```

Flyway sam zaaplikuje nowe migracje DB przy starcie backendu — **nie wymaga ręcznych zmian schematu.**

---

## 9. Pytania otwarte / TODO na potem

- [ ] SMS gateway (Twilio / SMSAPI.pl) — obecnie tylko email jest aktywny. Backend ma `sms-gateway` microlib gotową, ale nie ma jeszcze konfiguracji prod.
- [ ] HTTPS (Let's Encrypt / Cloudflare Tunnel) — obecnie tylko HTTP localhost. Na zewnętrzny dostęp potrzebny reverse proxy (nginx / Caddy / Cloudflared).
- [ ] Backup automatyczny (systemd timer / cron)
- [ ] Monitoring uptime (Uptime Kuma / Grafana)
- [ ] CLI do tworzenia admina bez SQL-a

---

**Kontakt deweloperski:** Eryk @ AtlasJedi (https://github.com/AtlasJedi/misza_madafaka)
