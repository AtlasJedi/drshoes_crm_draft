# Spec — Dr Shoes Local Bundle Installer (Catalina-compatible)

**Date:** 2026-05-20
**Owner directive:** Build a self-contained installer that runs Dr Shoes admin on macOS 10.15 Catalina (Intel) with one double-click. Deliverable lands on Google Drive. **Isolation: this work is for the client. Everything pipeline-related lives in a new top-level `client-installer/` directory. Backend/frontend changes are profile-gated and inactive outside `profile=bundle`. Future shipping is iterative — each version is a fresh full zip.**

---

## Context

The recipient is on **macOS 10.15 Catalina, Intel x86_64** — a hard floor that excludes:
- Stock Adoptium Temurin JDK 21 (needs macOS 11+)
- Docker Desktop (needs macOS 12+)
- Postgres.app (needs macOS 11+)
- Apple Silicon native builds

We must ship a **single zip** containing every runtime the app needs. The recipient has no developer tools, no Homebrew, no Docker. Their entire interaction is: download → unzip → double-click → admin panel opens in their browser.

The project already targets non-technical users (commits `617a763`, `03b3c0c`, `fe1b206` added handoff `.command` scripts + `make backup`/`make update`). This spec extends that handoff workflow for the offline-local case.

---

## Constraints

| Layer | Choice | Reason |
|-------|--------|--------|
| JDK | **Liberica JDK 21 Standard, x86_64, macOS** (`bellsoft-jdk21.x.x+y-macos-amd64.tar.gz`) | Bellsoft Standard distro officially supports macOS **10.13+**. Stock Adoptium needs 11+. Bundled inside zip, never installed system-wide. |
| Node | **Node.js 18 LTS, x64, darwin** (`node-v18.x.x-darwin-x64.tar.gz`) | Last Node line that supports macOS 10.15. Node 20 dropped 10.15. Bundled inside zip. |
| Postgres | **`io.zonky.test:embedded-postgres` + `embedded-postgres-binaries-darwin-amd64:16.x`** | Statically-linked Postgres 16 binaries that run on macOS 10.13+. No system Postgres install. Data dir at `./data/pg/`. |
| Blob storage | **New `LocalFsBlobStorage`** | MinIO bundling is heavyweight + unverified on Catalina. Local-fs is the simplest interface that satisfies `BlobStorage`. Photos written under `./data/blobs/`. |
| Email/SMS | **`NoOpMessageProvider`** that logs the would-be send | Recipient has no SMTP/Twilio credentials. The MessageRouter call path stays exercised; outbound payloads land in `./logs/messages.log`. |
| OTel/Jaeger | **Disabled** in bundle profile | No Jaeger to bundle. `management.tracing.enabled=false` + `otel.sdk.disabled=true`. |
| Web | **Next.js standalone build** (`output: 'standalone'`) | Self-contained `server.js` + minimal node_modules. Run via bundled Node. |

All bundled runtimes live **inside the zip** — `./jre/`, `./node/`. No PATH pollution, no system installs.

---

## Isolation & directory layout

All bundle pipeline lives under a new top-level **`client-installer/`** directory. The main repo (`backend/`, `apps/web/`) only sees additive, profile-gated code.

```
misza_madafaka/                     ← project root
├── backend/                        (existing — adds profile=bundle code, inactive elsewhere)
├── apps/web/                       (existing — adds output:standalone to next.config.mjs)
├── client-installer/               ← ALL new pipeline artifacts live here
│   ├── README.md                   (developer-facing: how to build + ship a release)
│   ├── CHANGELOG.md                (versions shipped to client, dates, notes)
│   ├── VERSION                     (current bundle version, e.g. "1.0.0")
│   ├── build-bundle.sh             (the one-shot build script)
│   ├── fetch-cached.sh             (download helper with checksum cache)
│   ├── templates/                  ← copied INTO each zip
│   │   ├── DrShoes.command
│   │   ├── Stop-DrShoes.command
│   │   └── README.txt              (Polish, non-technical — for the client)
│   ├── verify.sh                   (static otool/file checks on the assembled bundle)
│   ├── cache/                      (git-ignored — JDK + Node tarballs cached here)
│   └── dist/                       (git-ignored — built zips land here)
└── (the rest of the repo, unchanged in shape)
```

**Why a new top-level dir vs. nesting under `tools/`:**
- The pipeline is a separate product cycle ("shipping a desktop installer to a client") with its own version, changelog, and release runbook. It deserves its own root namespace so it's discoverable and grep-able.
- `client-installer/` can be selectively excluded from CI (it doesn't need to run on every PR) and can later be split into its own repo if needed.
- A future v2 (Apple Silicon native bundle, signed builds) lands in the same dir without polluting `backend/` or `apps/`.

**What the main repo gains:**
- `application-bundle.yaml` in `backend/app/src/main/resources/`
- `BundleEmbeddedPostgresAutoConfig` + `LocalFsBlobStorage` + `LocalBlobController` + 3 noop messaging providers — all `@Profile("bundle")` or `@ConditionalOnProperty(prefix="drshoes.storage", name="type", havingValue="local-fs")`. Zero runtime impact in dev/prod.
- A `bundle` Maven profile in `backend/pom.xml` that's opt-in via `mvn -Pbundle …`.
- `output: 'standalone'` in `apps/web/next.config.mjs` (no runtime change in dev — only affects `next build` output).

---

## Versioning & shipping updates

- **Bundle version is independent of git tags.** `client-installer/VERSION` is the source of truth. The build script reads it and stamps `.version` into the zip + names the file `DrShoes-Local-${VERSION}.zip`.
- **Each release is a full fresh zip.** No diff/patch mechanism. ~400 MB per ship; recipient replaces the folder, keeping their `data/` (the launcher reuses `data/` whether it's in the new or old folder — the README will direct: "skopiuj data/ ze starego folderu do nowego przed pierwszym uruchomieniem").
- **Release flow** (documented in `client-installer/README.md`):
  1. Bump `client-installer/VERSION` (semver).
  2. Add a `CHANGELOG.md` entry: date, version, what's new for the client.
  3. Run `./client-installer/build-bundle.sh`.
  4. Run `./client-installer/verify.sh` — static checks + dev-Mac smoke.
  5. Upload `client-installer/dist/DrShoes-Local-${VERSION}.zip` to Google Drive (manual).
  6. Tag git `bundle-v${VERSION}` so we can rebuild the exact ship later.
- **Future automation hook:** an opt-in `upload-bundle.sh` (out of scope for v1) wraps `rclone copy`. Designed to slot into the flow without touching `build-bundle.sh`.

---

## Architecture

### Zip layout

```
DrShoes-Local-1.0.0.zip   (~380–420 MB before compression, ~250 MB compressed)
└── DrShoes-Local/
    ├── DrShoes.command           ← double-click launcher (chmod +x, executable)
    ├── Stop-DrShoes.command      ← optional: clean shutdown launcher
    ├── README.txt                ← Polish, non-technical
    ├── jre/                      ← Liberica JDK 21 (≈200 MB)
    │   └── Contents/Home/bin/java
    ├── node/                     ← Node 18 LTS (≈60 MB)
    │   └── bin/node
    ├── backend/
    │   └── drshoes-app.jar       ← Spring Boot fat JAR with embedded-postgres
    ├── web/                      ← Next standalone build (≈50 MB)
    │   ├── server.js
    │   ├── .next/
    │   ├── public/
    │   └── node_modules/         ← only standalone runtime deps
    ├── config/
    │   └── application-bundle.yaml (read-only template, copied to data/ on first run)
    ├── data/                     ← created on first run, never overwritten
    │   ├── pg/                   ← Postgres data dir
    │   ├── blobs/                ← photo blob storage
    │   └── logs/
    └── .version                  ← "1.0.0" — used by future updates
```

### Spring profile: `bundle`

New `application-bundle.yaml`:

```yaml
spring:
  datasource:
    # URL injected at runtime from EmbeddedPostgres.getJdbcUrl()
    username: drshoes
    password: drshoes-bundle-local
  jpa:
    hibernate.ddl-auto: none
  flyway:
    enabled: true
    locations: classpath:db/migration

drshoes:
  storage:
    type: local-fs
    root: ${user.dir}/data/blobs
  messaging:
    email-provider: noop
    sms-provider: noop
    whatsapp-provider: noop
  demo:
    seed-enabled: true   # first-run only; SeedRunner is idempotent
  embedded-postgres:
    data-dir: ${user.dir}/data/pg
    port: 0              # auto-pick free port

management:
  tracing.enabled: false

otel:
  sdk.disabled: true
```

A new `@Configuration BundleEmbeddedPostgresAutoConfig`:
1. Starts `EmbeddedPostgres` pointing at `drshoes.embedded-postgres.data-dir` (persistent across restarts via `setDataDirectory()`).
2. Registers a `DataSource` bean wired to the embedded instance's `getJdbcUrl()`.
3. Flyway runs against that DataSource on boot (migrations V001…V034 unchanged).
4. Idempotent: on second boot, embedded-postgres reuses the data dir.

Activated by `SPRING_PROFILES_ACTIVE=bundle` set by the launcher.

### Storage swap: `LocalFsBlobStorage`

New class in `backend/libs/storage`:

```java
public class LocalFsBlobStorage implements BlobStorage {
    private final Path root;

    public byte[] get(BlobKey key) { ... read from root/key.fullPath ... }
    public BlobMetadata put(BlobKey key, byte[] bytes, String contentType) { ... write to root/key.fullPath ... }
    public void delete(BlobKey key) { ... }
    public PresignedUrl presignGet(BlobKey key, Duration ttl) {
        // returns http://localhost:8080/api/admin/photos/local/{path}
        // a new minimal LocalBlobController serves files from this root
    }
}
```

`StorageAutoConfiguration` already picks an impl based on properties — extend to recognize `type: local-fs` and instantiate `LocalFsBlobStorage`. `S3BlobStorage` and `NoOpBlobStorage` unchanged.

A new `LocalBlobController` (only registered under `bundle` profile) serves blobs from `root/{path}` with the right `Content-Type`, gated by the same admin session as the rest of the admin API.

### Messaging swap: no-op providers

`messaging-core` already has the provider interface. New impls:
- `NoopEmailProvider implements EmailProvider` — logs the payload to `./data/logs/messages.log` with `outcome=NOOP_BUNDLE` and returns a synthetic message id.
- `NoopSmsProvider`, `NoopWhatsappProvider` — same shape.

Wired via `drshoes.messaging.*-provider: noop` properties.

---

## Launcher script — `DrShoes.command`

```bash
#!/bin/bash
set -e
cd "$(dirname "$0")"
BUNDLE_DIR="$PWD"

# 1. Sanity checks (Catalina-friendly: no jq, no GNU coreutils)
if [ ! -f "jre/Contents/Home/bin/java" ]; then
  osascript -e 'display alert "Brakuje pliku JRE" message "Rozpakuj cały ZIP najpierw, potem uruchom ponownie."'
  exit 1
fi
mkdir -p data/pg data/blobs data/logs

# 2. Detect leftover Dr Shoes processes from a previous run and stop only those
#    (never blindly kill anything on the port — could be the recipient's other app)
for pidfile in data/backend.pid data/web.pid; do
  if [ -f "$pidfile" ]; then
    OLDPID=$(cat "$pidfile")
    if kill -0 "$OLDPID" 2>/dev/null; then kill "$OLDPID" 2>/dev/null || true; fi
    rm -f "$pidfile"
  fi
done
# Verify ports are free; if not, surface the conflict to the user instead of nuking
for port in 8080 3000; do
  if lsof -ti tcp:$port > /dev/null 2>&1; then
    osascript -e "display alert \"Port $port jest zajęty\" message \"Inna aplikacja używa portu $port. Zamknij ją i spróbuj ponownie.\""
    exit 1
  fi
done

# 3. Start backend (logs → data/logs/backend.log)
export JAVA_HOME="$BUNDLE_DIR/jre/Contents/Home"
export SPRING_PROFILES_ACTIVE=bundle
nohup "$JAVA_HOME/bin/java" -Xss512k -Xmx1g \
  -Duser.dir="$BUNDLE_DIR" \
  -jar backend/drshoes-app.jar \
  > data/logs/backend.log 2>&1 &
BACKEND_PID=$!
echo "$BACKEND_PID" > data/backend.pid

# 4. Wait for /actuator/health
for i in $(seq 1 60); do
  if curl -fs http://localhost:8080/actuator/health > /dev/null 2>&1; then break; fi
  if ! kill -0 $BACKEND_PID 2>/dev/null; then
    osascript -e 'display alert "Backend nie wystartował" message "Sprawdź data/logs/backend.log"'
    exit 1
  fi
  sleep 2
done

# 5. Start web (logs → data/logs/web.log)
export PATH="$BUNDLE_DIR/node/bin:$PATH"
export NODE_ENV=production
export PORT=3000
export DRSHOES_API_BASE=http://localhost:8080
nohup "$BUNDLE_DIR/node/bin/node" web/server.js \
  > data/logs/web.log 2>&1 &
WEB_PID=$!
echo "$WEB_PID" > data/web.pid

# 6. Wait for web ready
for i in $(seq 1 30); do
  if curl -fs http://localhost:3000 > /dev/null 2>&1; then break; fi
  sleep 1
done

# 7. Open browser
open http://localhost:3000/admin/login

# 8. Friendly banner via osascript
osascript -e 'display notification "Otwórz przeglądarkę: http://localhost:3000/admin/login" with title "Dr Shoes uruchomione"'
```

**`Stop-DrShoes.command`** reads `data/backend.pid` + `data/web.pid` and `kill`s them, plus a final `lsof` sweep on 8080/3000.

`.command` files are executable scripts that double-click in Finder runs as a Terminal session — the same pattern `617a763` already added to `handoff/`.

---

## Build pipeline — `client-installer/build-bundle.sh`

Runs from repo root. All inputs and outputs live under `client-installer/`; the script only reads from `backend/` and `apps/web/`.

```bash
#!/bin/bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"           # client-installer/
REPO="$(cd "$HERE/.." && pwd)"                  # repo root
VERSION="$(cat "$HERE/VERSION")"
DIST="$HERE/dist"
CACHE="$HERE/cache"
WORK="$DIST/DrShoes-Local"

rm -rf "$DIST" && mkdir -p "$WORK"/{backend,web,config,jre,node} "$CACHE"

# 1. Build backend JAR with embedded-postgres + bundle profile
( cd "$REPO/backend" && mvn -B -pl app -am -DskipTests -Pbundle clean package )
cp "$REPO/backend/app/target/app-"*"-SNAPSHOT.jar" "$WORK/backend/drshoes-app.jar"

# 2. Build Next standalone
( cd "$REPO/apps/web" && pnpm install --frozen-lockfile && pnpm build )
cp -R "$REPO/apps/web/.next/standalone/." "$WORK/web/"
mkdir -p "$WORK/web/.next" && cp -R "$REPO/apps/web/.next/static" "$WORK/web/.next/"
[ -d "$REPO/apps/web/public" ] && cp -R "$REPO/apps/web/public" "$WORK/web/"

# 3. Download Liberica JDK 21 (cached)
LIBERICA_URL="https://download.bell-sw.com/java/21.0.5+11/bellsoft-jdk21.0.5+11-macos-amd64.tar.gz"
"$HERE/fetch-cached.sh" "$LIBERICA_URL" "$CACHE/liberica.tar.gz"
tar -xzf "$CACHE/liberica.tar.gz" -C "$WORK/jre" --strip-components=1

# 4. Download Node 18 LTS
NODE_URL="https://nodejs.org/dist/v18.20.5/node-v18.20.5-darwin-x64.tar.gz"
"$HERE/fetch-cached.sh" "$NODE_URL" "$CACHE/node.tar.gz"
tar -xzf "$CACHE/node.tar.gz" -C "$WORK/node" --strip-components=1

# 5. Copy launchers + config + README from templates
cp "$HERE/templates/DrShoes.command" "$WORK/"
cp "$HERE/templates/Stop-DrShoes.command" "$WORK/"
cp "$HERE/templates/README.txt" "$WORK/"
cp "$REPO/backend/app/src/main/resources/application-bundle.yaml" "$WORK/config/"
chmod +x "$WORK"/*.command

echo "$VERSION" > "$WORK/.version"

# 6. Zip
( cd "$DIST" && zip -ry "DrShoes-Local-$VERSION.zip" "DrShoes-Local" )
echo "Built: $DIST/DrShoes-Local-$VERSION.zip ($(du -h "$DIST/DrShoes-Local-$VERSION.zip" | cut -f1))"
```

Cached downloads in `client-installer/cache/` (git-ignored) so re-builds don't re-download ~260 MB of JDK + Node.

**New Maven profile `bundle`** on `backend/pom.xml`:
- Adds `io.zonky.test:embedded-postgres:2.0.7` + `embedded-postgres-binaries-darwin-amd64:16.4.0` as runtime deps (not in default jar to keep dev jar slim).
- Activates `BundleEmbeddedPostgresAutoConfig`.

---

## First-run lifecycle

1. **Unzip preserves +x bits on `.command` files** if recipient uses Finder's default Archive Utility — verified pattern for `617a763`.
2. **First double-click** → launcher creates `data/pg`, `data/blobs`, `data/logs`. Embedded Postgres calls `initdb` on first run (one-time ~5 s).
3. **Flyway** applies V001..V034 against the fresh DB.
4. **SeedRunner** creates the demo admin user `misza@drshoes.pl` / `change-me-on-first-login` (existing seed already does this — gated by `drshoes.demo.seed-enabled`).
5. **Browser opens** to `/admin/login`. Recipient logs in.
6. **Subsequent runs** reuse `data/pg` — no re-init, no re-seed (SeedRunner is idempotent).

---

## README.txt (Polish, non-technical)

```
Dr Shoes — instalacja lokalna
==============================

WYMAGANIA:
• macOS 10.15 (Catalina) lub nowszy, Intel
• ~1 GB wolnego miejsca

INSTALACJA (raz):
1. Rozpakuj plik DrShoes-Local-1.0.0.zip dwuklikiem.
2. Otwórz folder "DrShoes-Local".

URUCHAMIANIE:
1. Dwuklik na "DrShoes.command".
   (Jeśli macOS zapyta o pozwolenie: Preferencje → Bezpieczeństwo → "Otwórz mimo to".)
2. Poczekaj ~30 sekund. Przeglądarka otworzy się automatycznie.
3. Zaloguj się:
   E-mail:  misza@drshoes.pl
   Hasło:   change-me-on-first-login

ZATRZYMANIE:
• Dwuklik na "Stop-DrShoes.command".

KOPIA ZAPASOWA:
• Cały folder "data/" zawiera bazę i zdjęcia. Skopiuj go, by zachować dane.

PROBLEMY:
• Logi: folder "data/logs/" (backend.log, web.log).
• Pomoc: putiatycki.p@gmail.com
```

---

## Google Drive upload

`rclone` / `gdrive` CLI / mounted Drive folder are **not** configured on the dev machine. Two paths:

1. **Manual (default).** Build outputs `client-installer/dist/DrShoes-Local-1.0.0.zip`. Owner drags into Google Drive web UI. Plan task captures this step explicitly.
2. **Automated (optional follow-up, not blocking).** Owner installs `rclone` + configures Google Drive remote once → `client-installer/upload-bundle.sh` does `rclone copy client-installer/dist/DrShoes-Local-*.zip gdrive:DrShoes/`. Defer until after first manual upload proves the bundle works.

---

## Testing strategy

I cannot smoke-test on Catalina. The plan covers:

1. **Boot test on dev Mac (macOS 26.x Apple Silicon).** Java 21 fat JAR with bundle profile + embedded Postgres boots green, Flyway applies, seed runs, `/actuator/health` returns UP, Next standalone renders `/admin/login`, login works, smoke through one order create + photo upload. **This is the gate before any Catalina handoff.**
2. **Static checks for Catalina compat.**
   - `file jre/Contents/Home/bin/java` → confirm `Mach-O 64-bit executable x86_64`.
   - `otool -l` on java + node → confirm `LC_BUILD_VERSION` `minos` ≤ `10.13` (Liberica) / `10.15` (Node 18).
   - `vmmap`/`codesign --display` smoke that binaries are not arm64-only.
3. **Optional UTM/QEMU verification.** If a Catalina VM image is reachable, boot it and run the bundle. Out of scope for v1 — flagged as risk.

Existing backend test suite (390+ tests) MUST stay green with the new `bundle` profile changes. The plan will require this gate before any zip ship.

---

## What this spec deliberately does NOT include

- **No public site bundling beyond what Next standalone produces.** The launcher only opens `/admin/login`. Public routes still exist in the build but aren't promoted.
- **No automatic update mechanism.** Recipient gets a new zip when there's a new version. No in-app updater.
- **No email/SMS real sends.** Messages log to file. Adding real providers later is just config — no schema change.
- **No HTTPS / certificate.** Localhost-only. No tunnel.
- **No Apple notarization or signing.** Recipient will see the "unidentified developer" Gatekeeper dialog and must right-click → Open the first time. README documents this.
- **No Apple Silicon native build.** Catalina is x86_64 only; bundle is x86_64 only. Rosetta-mode on Apple Silicon would work but isn't a stated requirement.
- **No multi-user / multi-machine sync.** Single laptop, single recipient.

---

## Risks & open questions

| Risk | Severity | Mitigation |
|------|----------|------------|
| Liberica JDK 21 `x86_64` may not actually launch on Catalina despite docs saying 10.13+ | HIGH | Verify `LC_BUILD_VERSION minos` via `otool -l`; if blocked, fall back to **Liberica JDK 17** (the Spring Boot 3.4 boundary). Plan has a contingency task. |
| Zonky embedded-postgres `darwin-amd64` 16.x may have macOS-version-min issues | HIGH | Same — `otool -l` on the extracted binary inside the JAR. If blocked, pin to PG 15.x binaries which have a longer macOS-min history. |
| Next 16 standalone output may pull in arm64-only native modules (e.g., `sharp`) | MED | `next build` with `output: 'standalone'` + `--target=node18` flag; replace `sharp` with `@img/sharp-darwin-x64` resolution or disable image optimization (`images.unoptimized: true` in `next.config.mjs`). |
| Gatekeeper blocks unsigned `.command` and unsigned binaries on first launch | MED | README documents right-click → Open. Signing is out of scope for v1. |
| Bundle exceeds 500 MB and exceeds Google Drive free-tier per-file friction | LOW | 380–420 MB target. If overshooting, strip Liberica JRE-only (no JDK tools): saves ~100 MB. |
| Recipient unzips into iCloud/Documents and triggers permission prompts | LOW | README directs to `~/Applications/` or Desktop. |
| First-boot `initdb` time on slow disk feels broken | LOW | Launcher shows osascript progress dialog after 10 s if backend not yet healthy. |

---

## Acceptance criteria

1. `client-installer/build-bundle.sh` produces `client-installer/dist/DrShoes-Local-1.0.0.zip` ≤ 450 MB on a clean checkout.
2. On the dev Mac, unzipping + double-clicking `DrShoes.command` brings up `/admin/login` in < 60 s.
3. Login with seeded credentials succeeds, order list renders, photo upload succeeds (blob lands under `data/blobs/`), email send emits a `messages.log` line with `outcome=NOOP_BUNDLE`.
4. `Stop-DrShoes.command` cleanly kills both processes; second double-click on `DrShoes.command` reboots reusing `data/pg`.
5. `otool -l` confirms x86_64 + macOS-min ≤ 10.15 for JDK, Node, and embedded-postgres binaries.
6. Backend `mvn -B verify` stays green with the new `bundle` profile + `LocalFsBlobStorage` + noop providers.
7. README.txt is the only documentation needed for the recipient.

---

## Out of scope (future work, captured but not built)

- `rclone`-based auto-upload to Google Drive (manual upload v1).
- Code signing / Apple notarization.
- Apple Silicon native bundle (would be a parallel `darwin-arm64` variant).
- Auto-update mechanism (recipient downloads new zip).
- Real email/SMS providers in the bundle (config swap, no code change).
- Public site as a usable surface in the bundle.

---

## Effort estimate

~8–14 Sonnet-hours across 4 waves:
1. **Wave 1 — backend bundle profile (3 tasks):** new Maven profile, embedded-postgres autoconfig, `LocalFsBlobStorage`, noop messaging providers, `application-bundle.yaml`, integration test.
2. **Wave 2 — frontend standalone build (1 task):** `next.config.mjs` adjustments, verify `output: 'standalone'` produces a usable tree, handle `sharp`.
3. **Wave 3 — bundle pipeline in `client-installer/` (3 tasks):** dir scaffolding (VERSION/CHANGELOG/README), `build-bundle.sh`, `fetch-cached.sh`, `templates/DrShoes.command`, `templates/Stop-DrShoes.command`, `templates/README.txt`, `verify.sh`.
4. **Wave 4 — verification (1 task):** static otool/file checks scripted, end-to-end smoke on dev Mac, document Gatekeeper dance.

Plan will live at `docs/superpowers/plans/2026-05-20-bundle-installer.md`.
