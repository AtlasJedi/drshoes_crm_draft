# Music Player v2 — addendum

**Status:** spec addendum, owner-approved 2026-05-18 (afternoon)
**Supersedes parts of:** `2026-05-18-music-player-design.md`
**Branch:** `feat/music-player` (continues — no new branch)

## What changes

Two scope reversals from the v1 spec, plus one additive feature.

### 1. Music plays across all admin routes (REVERSES v1 non-goal)

**Was (v1):**
> Just on `/admin/muzyka`, music stops when you leave.

**Now (v2):**
Music keeps playing while navigating anywhere under `/admin/*`. Leaving the `/admin` shell (e.g., logging out, hitting `/public`) stops playback.

### 2. Shared playlists (REVERSES v1 non-goal "no persistence")

Full CRUD over **shared** playlists — one pool for the whole workshop, no per-user partitioning. Tracks stored with cached title/channel/thumbnail (YouTube doesn't guarantee these forever).

### 3. localStorage survives reload

Current track + queue position + volume survive `F5`. Playlists live in the DB; queue + current track + position live in localStorage.

---

## Architecture deltas

### Frontend — lifted state + persistent iframe

- New: `MusicProvider` React Context lives in `apps/web/app/(admin)/admin/layout.tsx` (or a thin client wrapper of it). Exposes `{ current, queue, playing, volume, currentTime, duration, playlists, playPause(), skipBack(), skipForward(), seek(), setVolume(), enqueue(), advance(), removeFromQueue(), reorderQueue(), savePlaylist(), addToPlaylist(), removeFromPlaylist(), renamePlaylist(), deletePlaylist(), loadPlaylistToQueue() }`.
- New: `PersistentMiniPlayer` component rendered inside `MusicProvider`. **Always mounts the YouTube iframe** while `current != null`. Shows compact UI (per designer export). Sits in admin chrome.
- Refactor: `apps/web/app/(admin)/admin/muzyka/MusicClient.tsx` no longer owns state — it consumes `MusicProvider`. No iframe on this page anymore (the iframe is in `PersistentMiniPlayer`).
- New: `apps/web/lib/music-storage.ts` — read/write `{ currentTrack, queue, currentTimeAtSave, volume }` to localStorage under key `drshoes.music.state`. Throttled writes (every 5 s + on state transitions).
- **Iframe rule:** the iframe DOM node must never unmount while a track is current. Moving it between containers breaks playback. The mini-player owns the iframe. The `/admin/muzyka` page does NOT render its own iframe.

### Backend — playlists module

- New Flyway: `V033__music_playlists.sql`
- New package: `com.drshoes.app.music` (extends existing module)
- Files:
  - `MusicPlaylist.java` — entity
  - `MusicPlaylistTrack.java` — entity, FK to playlist, ordered by `sort_order`
  - `MusicPlaylistRepository.java`
  - `MusicPlaylistTrackRepository.java`
  - `MusicPlaylistService.java`
  - `MusicPlaylistController.java`
  - `PlaylistDto.java`, `PlaylistTrackDto.java`, `CreatePlaylistRequest.java`, `RenamePlaylistRequest.java`, `AddTrackRequest.java`, `ReorderTracksRequest.java`
  - Tests: `MusicPlaylistServiceTest.java`, `MusicPlaylistControllerTest.java`

### V033 SQL

```sql
CREATE TABLE music_playlist (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name       VARCHAR(120) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE music_playlist_track (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    playlist_id    UUID NOT NULL REFERENCES music_playlist(id) ON DELETE CASCADE,
    video_id       VARCHAR(32) NOT NULL,
    title          VARCHAR(500) NOT NULL,
    channel_title  VARCHAR(200) NOT NULL,
    thumbnail_url  VARCHAR(500),
    sort_order     INT NOT NULL,
    added_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_playlist_track_playlist_order
    ON music_playlist_track(playlist_id, sort_order);
```

### REST contracts

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| GET    | `/api/admin/music/playlists` | — | `PlaylistDto[]` (id, name, trackCount, updatedAt — NO tracks inline) |
| POST   | `/api/admin/music/playlists` | `{ name }` | `PlaylistDto` (201) |
| GET    | `/api/admin/music/playlists/{id}` | — | `PlaylistDto` with `tracks: PlaylistTrackDto[]` |
| PATCH  | `/api/admin/music/playlists/{id}` | `{ name }` | `PlaylistDto` |
| DELETE | `/api/admin/music/playlists/{id}` | — | 204 |
| POST   | `/api/admin/music/playlists/{id}/tracks` | `{ videoId, title, channelTitle, thumbnailUrl }` | `PlaylistTrackDto` (201, appended) |
| DELETE | `/api/admin/music/playlists/{id}/tracks/{trackId}` | — | 204 |
| PATCH  | `/api/admin/music/playlists/{id}/tracks` | `{ trackIds: [uuid, ...] }` | `PlaylistTrackDto[]` (full reordered list) |

Validation:
- `name` non-blank, length ≤ 120
- 400 `{error:"invalid_name"}` on bad name
- 404 `{error:"playlist_not_found"}` on unknown id
- 409 `{error:"duplicate_name"}` on POST/PATCH where name collides (case-insensitive)

Auditing:
- All write operations: `@Audited` with `parent="#result.id"` style (playlist mutations are real state changes, worth logging)
- All read operations: structured log only, NOT `@Audited`

Errors stay simple — no soft-delete, no archive (per `[[feedback-simplest-working]]`).

---

## What stays the same

- `/api/admin/music/search` — unchanged
- YouTube IFrame Player API + `react-youtube` — unchanged
- Session auth + admin role — unchanged
- `YOUTUBE_API_KEY` — unchanged
- No queue persistence in DB (it's localStorage + Context state)

---

## Non-goals (still)

- Per-user playlists — explicitly shared, owner picked this
- Playlist sharing/exporting outside the app
- Cross-device sync (each browser has its own localStorage)
- Public access — admin-only
- Playlist cover art / custom artwork
- Search inside a playlist

---

## Verification plan (v2)

- Backend tests: 9 v1 + ~10 new for playlists = ~19 unit tests
- Playwright cross-route: navigate `/admin/muzyka` → start track → navigate to `/admin` → assert mini-player visible + audio still active (iframe still has src) → return to `/admin/muzyka` → assert same current + queue
- Playwright CRUD: create playlist via modal → add track from search dropdown → reload page → playlist still there with track → rename → delete
- localStorage: start track, F5 → current track + queue + position resumes
