# Dr Shoes — uruchomienie u klienta

Krok po kroku jak postawić aplikację Dr Shoes na własnym komputerze. Cała aplikacja chodzi w Dockerze — nie trzeba instalować Javy ani Node.js.

> **Status:** świeża baza, dwa konta gotowe do logowania, zero danych testowych.
> **Wsparcie:** Eryk — putiatycki.p@gmail.com (https://github.com/AtlasJedi)

---

## 1. Co musisz mieć na komputerze

| Wymagania | Wersja | Po co |
|---|---|---|
| Docker Desktop (Win/Mac) lub Docker Engine (Linux) | ≥ 24 | runtime aplikacji |
| Docker Compose plugin | ≥ 2.20 | uruchamia całość jedną komendą |
| RAM | ≥ 4 GB | Postgres + backend + frontend jednocześnie |
| Wolne miejsce | ≥ 10 GB | obrazy Dockera + baza + zdjęcia zleceń |
| Git | dowolna | tylko do pobrania kodu |

Pobierz Docker Desktop: https://www.docker.com/products/docker-desktop/

Pierwsze uruchomienie pobierze ~1.5 GB obrazów. Kolejne starty są instant.

---

## 2. Pobierz kod

```bash
git clone https://github.com/AtlasJedi/misza_madafaka.git
cd misza_madafaka
```

---

## 3. Wypełnij plik `.env`

```bash
cp .env.example .env
```

Następnie otwórz `.env` w dowolnym edytorze (Notepad, VS Code, `nano .env`) i zwróć uwagę na sekcje z markerem **`[ZMIEŃ]`**:

### Minimum do pierwszego uruchomienia

Możesz **zostawić wszystkie wartości domyślne** — aplikacja wystartuje. Maile nie będą realnie wysyłane (tylko logowane), ale cała reszta działa.

### Aby maile do klientów warsztatu działały (rekomendowane)

Wypełnij sekcję `MESSAGING_EMAIL_*` + `SPRING_MAIL_*`:

```bash
MESSAGING_EMAIL_PROVIDER=smtp
MESSAGING_EMAIL_SMTP_FROM=warsztat@drshoes.pl          # adres "od kogo"
MESSAGING_EMAIL_SMTP_FROM_NAME=Dr Shoes
SPRING_MAIL_HOST=smtp.gmail.com
SPRING_MAIL_PORT=465
SPRING_MAIL_USERNAME=warsztat.drshoes@gmail.com        # ten sam co FROM przy Gmailu
SPRING_MAIL_PASSWORD=xxxx xxxx xxxx xxxx               # 16-znakowy App Password
```

**Gmail App Password** (jeśli używasz Gmaila):
1. Włącz weryfikację dwuetapową: https://myaccount.google.com/security
2. Wygeneruj App Password: https://myaccount.google.com/apppasswords
3. Skopiuj 16-znakowe hasło do `SPRING_MAIL_PASSWORD`

Pełna instrukcja konfiguracji maila (Gmail / Google Workspace / Resend / własna domena) — zobacz **DEPLOYMENT.md**, sekcja 3.

### Tożsamość warsztatu w mailach

Te wartości pojawiają się w treści maili wysyłanych do klientów (placeholdery `{nazwa_warsztatu}`, `{adres_warsztatu}`, itd.):

```bash
DRSHOES_WORKSHOP_NAME=Dr Shoes
DRSHOES_WORKSHOP_ADDRESS=ul. Przykładowa 1, 00-000 Miasto
DRSHOES_WORKSHOP_OPENING_HOURS=pon–pt 10:00–18:00 · sob 11:00–15:00
DRSHOES_WORKSHOP_URL=https://drshoes.pl
```

---

## 4. Uruchom aplikację

```bash
make up
```

(jeśli nie masz `make` na Windows — uruchom bezpośrednio: `docker compose up -d --build`)

Pierwszy start trwa 2-3 minuty (build + pobranie obrazów + migracje bazy). Gdy gotowe:

- **Panel admina:** http://localhost:3000/admin/login
- **Health check API:** http://localhost:8080/actuator/health

> Wejście na `http://localhost:3000` od razu przekierowuje na panel admina — w tej instalacji strona publiczna jest wyłączona (tylko CRM).

Jeśli któryś z URLi nie ładuje — sprawdź logi:

```bash
make logs            # cała aplikacja, wyjście Ctrl+C
docker compose ps    # status wszystkich kontenerów
```

---

## 5. Pierwsze logowanie

Aplikacja przy starcie tworzy automatycznie dwa konta:

| Email | Rola | Hasło początkowe |
|---|---|---|
| `misza@drshoes.pl` | OWNER (właściciel, pełne uprawnienia) | `change-me-on-first-login` |
| `pomocnik@drshoes.pl` | EMPLOYEE (pracownik) | `change-me-on-first-login` |

### Zaloguj się jako właściciel:

http://localhost:3000/admin/login → `misza@drshoes.pl` / `change-me-on-first-login`

### ⚠️ Zmień hasła **natychmiast po pierwszym logowaniu**

Z poziomu terminala (w katalogu projektu):

```bash
# zmiana hasła właściciela
make set-password EMAIL=misza@drshoes.pl PASSWORD='TwojeNoweMocneHaslo123!'

# zmiana hasła pracownika
make set-password EMAIL=pomocnik@drshoes.pl PASSWORD='HasloPracownika456!'
```

### Zmień nazwy / emaile kont na własne

```bash
# zmiana imienia i nazwiska właściciela + nowy email
make rename-user EMAIL=misza@drshoes.pl NAME='Jan Kowalski' NEW_EMAIL=jan@drshoes.pl

# tylko imię pracownika
make rename-user EMAIL=pomocnik@drshoes.pl NAME='Anna Nowak'
```

### Sprawdź listę kont

```bash
make list-users
```

---

## 6. Codzienne komendy

```bash
make up            # start aplikacji (po reboocie komputera)
make down          # zatrzymaj (dane zostają)
make logs          # podgląd logów na żywo
make psql          # konsola SQL do bazy (zaawansowane)
make clean         # ⚠️ ZATRZYMAJ + USUŃ DANE (baza + zdjęcia) — nie odwracalne
```

Po `make down` baza zostaje. Po `make clean` baza znika.

---

## 7. Co możesz mi wysłać żebym dokończył konfigurację

Aby dopiąć aplikację pod konkretny warsztat, prześlij mi:

### Obowiązkowe
- [ ] **Pełna nazwa warsztatu** (jak ma wyglądać w mailach do klientów)
- [ ] **Adres warsztatu** (ul., kod, miasto)
- [ ] **Godziny otwarcia** (np. "pon–pt 10:00–18:00, sob 11:00–15:00")
- [ ] **Email właściciela** + imię i nazwisko (zastąpi `misza@drshoes.pl`)
- [ ] **Email pracownika** + imię i nazwisko (zastąpi `pomocnik@drshoes.pl`)

### Email (jeśli chcesz, żeby maile do klientów wychodziły)
- [ ] **Adres skąd wysyłamy** (np. `warsztat@drshoes.pl` lub `warsztat.drshoes@gmail.com`)
- [ ] **Wybór dostawcy:**
  - Gmail osobisty (limit 500 maili/dobę, najszybsze ustawienie)
  - Google Workspace (~30 zł/mc, limit 2000/dobę, własna domena)
  - Resend / Postmark (darmowe 3000 maili/mc, profesjonalna obsługa, własna domena)
  - Inny — daj znać jaki
- [ ] **Dostęp do skrzynki / panelu** żebym wygenerował App Password / klucz API (lub zrób to sam i prześlij — DEPLOYMENT.md ma instrukcje)

### Opcjonalne (na później)
- [ ] **SMS** — czy potrzebny i u jakiego operatora (SMSAPI.pl, Twilio, etc.)
- [ ] **Domena produkcyjna** — jeśli chcesz wystawić aplikację na świat (a nie tylko `localhost`)
- [ ] **Backup** — gdzie ma się robić kopia bazy (chmura? dysk zewnętrzny?)

---

## 8. Najczęstsze problemy

| Objaw | Co zrobić |
|---|---|
| `make up` mówi "port already in use" | inna aplikacja używa portu 3000/8080/5432. Zmień port w `.env` (np. `BACKEND_PORT=8081`) i restart. |
| Logowanie zwraca 401 | hasło zostało już zmienione — użyj nowego, lub `make set-password` żeby zresetować |
| Maile nie dochodzą | `make logs \| grep -i mail` — szukaj błędu SMTP. Najczęściej zły App Password Gmaila. |
| Strona ładuje się bez końca | `docker compose ps` — sprawdź czy `backend` i `web` mają status `running` / `healthy` |
| Po reboocie nic nie działa | uruchom `make up` ponownie (Docker Desktop musi być uruchomiony) |

W razie problemu: prześlij wynik `make logs` (ostatnie ~100 linii) na maila — większość spraw da się zdiagnozować z logów.

---

## 9. Aktualizacje

Gdy wypchnę nową wersję na GitHuba — **jedna komenda załatwia wszystko**:

```bash
make update
```

`make update` robi w kolejności:
1. `make backup` — snapshot bazy do `backups/backup-YYYY-MM-DD-HHMMSS.sql.gz` (na wypadek gdyby coś się rąbnęło)
2. `git pull --ff-only origin main` — pobiera nowy kod
3. `docker compose build backend web` — przebudowuje obrazy
4. `make up` — restart kontenerów

Migracje bazy zaaplikują się automatycznie przy starcie. **Twoje dane (klienci, zlecenia, zdjęcia, ustawienia) zostają nietknięte.**

### Sam backup (bez updatu)

```bash
make backup        # snapshot do backups/backup-...sql.gz
ls -lh backups/    # zobacz wszystkie kopie
```

### Restore z backupu (w razie awarii)

```bash
gunzip < backups/backup-2026-05-20-150000.sql.gz | docker compose exec -T postgres psql -U drshoes -d drshoes
```

### ⚠️ Ograniczenia automatycznego update'u

- **Nie edytuj plików w repo** poza `.env` — `git pull` zrobi merge conflict. `.env` jest gitignored i bezpieczny.
- **Nowe pole w `.env.example`** — jeśli nowa wersja wymaga nowej zmiennej, dodam komentarz w mailu/changelogu. Po `make update` porównaj `.env.example` ↔ twój `.env`.
- **`make update` wymaga że jesteś na branchu `main`** — domyślnie tak jest po `git clone`.

---

**Dokumentacja techniczna:** `DEPLOYMENT.md` (szczegóły konfiguracji email/SMS/backup), `ARCHITECTURE.md` (architektura), `README.md` (przegląd dla developera).
