# Music Player — `/admin/muzyka`

**Status:** design, owner-approved 2026-05-18
**Scope:** quick feature, single page, no DB, no migrations
**Branch:** `feat/music-player`

## Why

Workshop staff want background music while working. Today they reach for a phone or laptop. A built-in YouTube search + player inside the admin panel keeps eyes on one screen.

## Non-goals

- Persistent playlists / history / favourites
- Cross-page mini player (music stops when leaving `/admin/muzyka`)
- Other sources (Spotify, SoundCloud)
- Multi-user / shared "what's playing" sync
- DRM workarounds — only what plays in the YouTube IFrame Player API plays here
- Rate limiting (explicitly waived by owner — fewer than 5 admins, trusted)

## Architecture

```
Browser                           Spring Boot                 Google
─────────                         ───────────                 ──────
/admin/muzyka  ──search q─────►  /api/admin/music/search ──► youtube/v3/search
   │                                       │      (key: env YOUTUBE_API_KEY)
   │ MusicTrackDto[]               ◄──json─┘
   │
   ▼
react-youtube  ◄──iframe─►  www.youtube.com/embed/<videoId>
   │ controls (play/pause/seek/volume)
   │ onEnd → pop next from in-memory queue
```

Frontend search → backend proxy → YouTube Data API. Backend is the only place the API key is read. Iframe streams audio+video directly from YouTube (zero bandwidth on our backend).

## Backend — `com.drshoes.app.music`

Mirrors the flat `sklep` package layout.

### Files

| File                          | Purpose                                                            | LOC budget |
| ----------------------------- | ------------------------------------------------------------------ | ---------- |
| `MusicController.java`        | `GET /api/admin/music/search?q=…`, admin-only                      | ≤ 70       |
| `YoutubeSearchService.java`   | Calls YT Data API v3, parses response into `MusicTrackDto[]`       | ≤ 100      |
| `MusicTrackDto.java`          | Record: `videoId, title, channelTitle, thumbnailUrl`               | ≤ 25       |
| `MusicSearchException.java`   | Thin runtime exception (cause + upstream status)                   | ≤ 20       |

### `MusicController`

- `GET /api/admin/music/search?q=…`
- Validates `q` is non-blank and `length ≤ 100`; otherwise 400 `{error:"invalid_query"}`.
- Calls `YoutubeSearchService.search(q)`; returns `MusicTrackDto[]` (max 20).
- On `MusicSearchException` → 502 `{error:"music_search_failed"}` (no upstream detail leaked).
- On missing API key (caught via service throwing) → 503 `{error:"music_disabled"}`.
- Structured INFO log only: `op=music.search q="<truncated 50ch>" actor=<adminEmail> results=<n> outcome=ok|fail`. **Not** `@Audited` — search is read-only, no `audit_log` row per keystroke.
- Admin guard via existing session check — same pattern as `/api/admin/orders` etc.

### `YoutubeSearchService`

- Reads `${app.music.youtube-api-key}` (bound from env `YOUTUBE_API_KEY`).
- If key is blank/missing → throw `MusicSearchException("music_disabled")` on every call.
- HTTP: `java.net.http.HttpClient` (built-in, no new dependency).
- Calls `GET https://www.googleapis.com/youtube/v3/search` with query params:
  - `part=snippet`
  - `type=video`
  - `videoCategoryId=10` (Music)
  - `maxResults=20`
  - `q=<encoded user query>`
  - `key=<api-key>`
- Parses the JSON response with Jackson:
  - `items[].id.videoId`
  - `items[].snippet.title`
  - `items[].snippet.channelTitle`
  - `items[].snippet.thumbnails.medium.url` (fallback to `default.url`)
- Items missing `videoId` (e.g., channel results that slipped through) are filtered out.
- Timeout: 5 s connect + 5 s read. Failure → `MusicSearchException`.

### Config

`backend/app/src/main/resources/application.yml`:

```yaml
app:
  music:
    youtube-api-key: ${YOUTUBE_API_KEY:}
```

`docker-compose.yml` (`backend` service): add `YOUTUBE_API_KEY: ${YOUTUBE_API_KEY:-}` so docker reads it from the host `.env`.

`.env.example`: append `# YOUTUBE_API_KEY=AIza...` documented line. Real value goes in `.env` (gitignored).

### Tests — `MusicControllerTest` (unit, no Spring)

`@WebMvcTest` slice, `YoutubeSearchService` mocked:

1. happy path — service returns 3 tracks → 200 with 3-element array
2. empty `q` → 400 `invalid_query` without hitting the service
3. service throws `MusicSearchException("music_disabled")` → 503
4. service throws generic `MusicSearchException` → 502

`YoutubeSearchServiceTest` (pure JUnit, no Spring):

5. blank api key → throws `music_disabled` immediately
6. successful parse — fed a recorded `youtube-search.json` fixture, returns 20 tracks
7. malformed upstream JSON → throws `MusicSearchException`
8. non-200 upstream → throws `MusicSearchException`

Upstream HTTP is stubbed by injecting a `HttpClient` whose `send(...)` is mocked, or by giving the service a small `HttpResponseSource` interface for testability. Pick whichever keeps LOC budget; spec leaves that to implementer.

**No integration tests** — no real YT call in CI, no DB involved.

## Frontend — `apps/web/app/(admin)/admin/muzyka/`

Route: `/admin/muzyka`. Client component (iframe requires window).

### Files

| File                                                                    | Purpose                                            | LOC budget |
| ----------------------------------------------------------------------- | -------------------------------------------------- | ---------- |
| `apps/web/app/(admin)/admin/muzyka/page.tsx`                            | Page shell, layout, server-side meta only          | ≤ 30       |
| `apps/web/app/(admin)/admin/muzyka/MusicClient.tsx`                     | Client component: search + queue + player wiring  | ≤ 180      |
| `apps/web/app/(admin)/admin/muzyka/components/SearchBar.tsx`            | Debounced input + result list                      | ≤ 80       |
| `apps/web/app/(admin)/admin/muzyka/components/PlayerControls.tsx`       | Custom play/pause, ±10s, seek, volume bar          | ≤ 100      |
| `apps/web/app/(admin)/admin/muzyka/components/QueueList.tsx`            | Current + up-next strip, click to skip / remove    | ≤ 60       |
| `apps/web/lib/music.ts`                                                 | `searchMusic()` fetch wrapper + types               | ≤ 50       |
| `apps/web/app/(admin)/admin/muzyka/__tests__/MusicClient.test.tsx`      | vitest+RTL: debounce, queue add, queue advance      | ≤ 100      |

### Dependency — `react-youtube`

- npm: `react-youtube` (~10 KB, 5y+ maintained, wraps the IFrame Player API).
- Imported in `MusicClient.tsx`. Provides `<YouTube videoId={...} onReady onEnd onStateChange opts={{playerVars:{...}}} />` plus a player ref with `.playVideo()`, `.pauseVideo()`, `.seekTo()`, `.setVolume()`, `.getCurrentTime()`.

### `MusicClient` (the brain)

State:

```ts
type Track = { videoId: string; title: string; channelTitle: string; thumbnailUrl: string };
const [current, setCurrent] = useState<Track | null>(null);
const [queue, setQueue] = useState<Track[]>([]);
const [playing, setPlaying] = useState(false);
const [progress, setProgress] = useState({ current: 0, duration: 0 });
const [volume, setVolume] = useState(80);
```

Behaviour:

- "Play" a search result → if nothing current, sets `current`; otherwise appends to `queue`.
- On `onEnd` from `<YouTube>` → if `queue.length > 0` shift head into `current`, else `setCurrent(null)`.
- Player controls call player ref methods; UI re-renders from `onStateChange` events.
- `useEffect` polls `getCurrentTime()` every 500 ms while playing to update progress bar.
- Volume slider 0–100 mapped to `setVolume()`.

### `SearchBar`

- 300 ms debounced input.
- Calls `searchMusic(q)` → renders rows (thumbnail · title · channelTitle).
- Each row has a click handler → calls `onPick(track)` (from `MusicClient`).
- Empty state: "Wpisz tytuł utworu albo artystę".
- Error state from backend: "Nie udało się wyszukać. Sprawdź klucz YouTube." (red inline banner).

### `PlayerControls`

- Big play/pause button, ±10 s skip, queue-next button, mute toggle, volume slider, current-time / duration display, scrubber bar (click to seek).
- All buttons use existing admin design tokens (same as the rest of the panel).

### `QueueList`

- Compact horizontal strip "Up next" below the player.
- Each chip: thumbnail + title (truncated). Click → skip-to. × button → remove from queue.
- Empty → small grey text "Brak kolejnych utworów".

### Tests — `MusicClient.test.tsx`

vitest + RTL, mocking `fetch` and a fake `react-youtube` (returns a stub ref with the methods we call):

1. typing into search debounces and calls `searchMusic` once after 300 ms
2. clicking a result with empty player → sets it as current
3. clicking a second result → appends to queue (does not replace current)
4. firing `onEnd` with non-empty queue → advances; with empty queue → clears current
5. backend error → shows the Polish error banner

### Sidebar nav entry

`apps/web/components/admin/AdminSidebarNav.tsx` — add **Muzyka** under a new `PRZERWA` section (or append to an existing section if owner prefers — I default to a new tiny section so it's clearly off-business). Spec freeze: new `PRZERWA` section, single entry `Muzyka` → `/admin/muzyka`.

## Data flow / contracts

**Request:**
```
GET /api/admin/music/search?q=lo-fi%20beats
```

**200 response:**
```json
[
  {
    "videoId": "jfKfPfyJRdk",
    "title": "lofi hip hop radio 📚 - beats to relax/study to",
    "channelTitle": "Lofi Girl",
    "thumbnailUrl": "https://i.ytimg.com/vi/jfKfPfyJRdk/mqdefault.jpg"
  }
]
```

**Error responses:**
- `400 {"error":"invalid_query"}` — blank or > 100 chars
- `502 {"error":"music_search_failed"}` — upstream failure
- `503 {"error":"music_disabled"}` — `YOUTUBE_API_KEY` not configured

## Owner action item (blocking before container restart)

1. Console → https://console.cloud.google.com/apis/credentials → key `AIzaSyDLbciUXEcBz_SpiyYTx641RBOTVQebV1o`
2. **API restrictions** → either "Don't restrict key" or add "YouTube Data API v3" alongside Places.
3. Save. Test with `curl ".../search?part=snippet&type=video&q=test&key=…"` → expect 200.
4. Add to `/Users/atlasjedi/P/misza_madafaka/.env`:
   ```
   YOUTUBE_API_KEY=AIzaSyDLbciUXEcBz_SpiyYTx641RBOTVQebV1o
   ```
5. Vault append: under `## Google Places API`, edit `**API enabled:**` line to add `YouTube Data API v3`.

## Verification plan

- Backend: `mvn -pl app -am -DskipTests clean package` → assert `BUILD SUCCESS`.
- Backend tests: `mvn -pl app test` → expect 8 new tests green.
- Frontend tests: `pnpm --filter web test` → expect new `MusicClient.test.tsx` green.
- Container rebuild: `docker compose build backend web && docker compose up -d backend web`.
- Curl smoke: `curl http://localhost:8080/api/admin/music/search?q=test -b "<admin session cookie>"` → 200 with at least 1 result, or 503 if owner skipped the key step.
- Playwright smoke: navigate to `/admin/muzyka`, type "lofi", assert ≥ 1 result row, click first, assert iframe `src` contains `videoId`.

## Out of scope (logged for future, do not implement)

- Persistent "last played" / favourites
- Volume / queue persistence across reloads (localStorage)
- Mini player in admin chrome
- Quota-burn rate limiting (waived; revisit if quota becomes a problem)
- Search result paging (we hard-cap at 20)
