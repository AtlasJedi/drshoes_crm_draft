# Music Player v2 — Backend Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or follow TDD task-by-task. This plan covers BACKEND ONLY — playlists CRUD + V033 migration. Frontend is design-blocked and not in this plan.

**Goal:** Ship the playlists backend (V033 migration + 8 REST endpoints + tests) on the existing `feat/music-player` branch, design-agnostic.

**Spec:** `docs/superpowers/specs/2026-05-18-music-player-v2-addendum.md`

**Branch state on entry:** `feat/music-player` at HEAD `63bcd4f` (v2 addendum committed). Music v1 backend already at `46b09a3`.

---

## File map

| File | Purpose | LOC |
| ---- | ------- | --- |
| `backend/app/src/main/resources/db/migration/V033__music_playlists.sql` | Tables + index | ~30 |
| `backend/app/src/main/java/com/drshoes/app/music/MusicPlaylist.java` | JPA entity | ~70 |
| `backend/app/src/main/java/com/drshoes/app/music/MusicPlaylistTrack.java` | JPA entity, FK to playlist | ~80 |
| `backend/app/src/main/java/com/drshoes/app/music/MusicPlaylistRepository.java` | Spring Data repo | ~25 |
| `backend/app/src/main/java/com/drshoes/app/music/MusicPlaylistTrackRepository.java` | Spring Data repo | ~25 |
| `backend/app/src/main/java/com/drshoes/app/music/MusicPlaylistService.java` | CRUD logic + reorder | ~140 |
| `backend/app/src/main/java/com/drshoes/app/music/MusicPlaylistController.java` | 8 endpoints | ~120 |
| `backend/app/src/main/java/com/drshoes/app/music/PlaylistDto.java` | record (id, name, trackCount, updatedAt, tracks?) | ~25 |
| `backend/app/src/main/java/com/drshoes/app/music/PlaylistTrackDto.java` | record (id, videoId, title, channelTitle, thumbnailUrl, sortOrder) | ~20 |
| `backend/app/src/main/java/com/drshoes/app/music/PlaylistRequests.java` | nested records: CreatePlaylistRequest, RenamePlaylistRequest, AddTrackRequest, ReorderTracksRequest | ~40 |
| `backend/app/src/main/java/com/drshoes/app/music/PlaylistException.java` | RuntimeException with code constants (NOT_FOUND, DUPLICATE_NAME, INVALID_NAME) | ~30 |
| `backend/app/src/test/java/com/drshoes/app/music/MusicPlaylistServiceTest.java` | 6+ unit cases with mocked repos | ~180 |
| `backend/app/src/test/java/com/drshoes/app/music/MusicPlaylistControllerTest.java` | 4+ unit cases with mocked service | ~140 |

---

## V033 SQL — exact content

```sql
-- =============================================================================
-- V033 — Shared workshop music playlists.
-- One pool for the whole admin team; no owner_user_id by design (decision
-- locked in 2026-05-18-music-player-v2-addendum.md).
-- =============================================================================

CREATE TABLE music_playlist (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name       VARCHAR(120) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT music_playlist_name_unique UNIQUE (name)
);

CREATE TABLE music_playlist_track (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    playlist_id   UUID NOT NULL REFERENCES music_playlist(id) ON DELETE CASCADE,
    video_id      VARCHAR(32) NOT NULL,
    title         VARCHAR(500) NOT NULL,
    channel_title VARCHAR(200) NOT NULL,
    thumbnail_url VARCHAR(500),
    sort_order    INT NOT NULL,
    added_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_music_playlist_track_playlist_order
    ON music_playlist_track(playlist_id, sort_order);
```

Note: case-insensitive uniqueness check happens in the service layer (avoids `LOWER()` functional index complexity). The DB unique constraint catches identical names; service handles the case-insensitive lookup with a `findByNameIgnoreCase` repo method.

---

## Endpoint implementation rules

### `GET /api/admin/music/playlists`
Returns `PlaylistDto[]` **without** the `tracks` list (use `trackCount` for UI badge). Ordered by `updated_at DESC`. No pagination.

### `GET /api/admin/music/playlists/{id}`
Returns `PlaylistDto` **with** populated `tracks` ordered by `sort_order ASC`. 404 if not found.

### `POST /api/admin/music/playlists`
Body: `{ name }`. Validate non-blank, length ≤ 120. Case-insensitive duplicate check → 409. Returns 201 + created `PlaylistDto`.

### `PATCH /api/admin/music/playlists/{id}` (rename)
Body: `{ name }`. Same validation as POST. Touches `updated_at`. Returns 200 + `PlaylistDto`.

### `DELETE /api/admin/music/playlists/{id}`
ON DELETE CASCADE handles tracks. Returns 204. 404 if not found.

### `POST /api/admin/music/playlists/{id}/tracks`
Body: `{ videoId, title, channelTitle, thumbnailUrl }`. `videoId` non-blank, ≤ 32 chars. Title non-blank, ≤ 500. `channelTitle` non-blank, ≤ 200. `thumbnailUrl` optional, ≤ 500. Appends to playlist with `sort_order = (max + 1)` (or 0 if empty). Touches playlist `updated_at`. Returns 201 + `PlaylistTrackDto`. 404 if playlist missing. Duplicate `videoId` in same playlist → allowed (user might want it twice).

### `DELETE /api/admin/music/playlists/{id}/tracks/{trackId}`
Removes single track. Re-sequences `sort_order` on remaining tracks (compaction). Touches playlist `updated_at`. Returns 204. 404 if track or playlist not found, or track doesn't belong to playlist.

### `PATCH /api/admin/music/playlists/{id}/tracks` (reorder)
Body: `{ trackIds: [uuid, ...] }`. Must contain exactly the playlist's current trackIds (any superset/subset → 400 `invalid_order`). Updates `sort_order` to match given array index. Touches playlist `updated_at`. Returns 200 + full ordered `PlaylistTrackDto[]`.

---

## Auditing

Use existing `@Audited` aspect on the service methods that mutate state. Pattern (mirroring other audited services):

- `createPlaylist`: `@Audited(action="MUSIC_PLAYLIST_CREATED", parent="#result.id")`
- `renamePlaylist`: `@Audited(action="MUSIC_PLAYLIST_RENAMED", parent="#id")`
- `deletePlaylist`: `@Audited(action="MUSIC_PLAYLIST_DELETED", parent="#id")`
- `addTrack`: `@Audited(action="MUSIC_PLAYLIST_TRACK_ADDED", parent="#playlistId")`
- `removeTrack`: `@Audited(action="MUSIC_PLAYLIST_TRACK_REMOVED", parent="#playlistId")`
- `reorderTracks`: `@Audited(action="MUSIC_PLAYLIST_REORDERED", parent="#playlistId")`

Reads (`listPlaylists`, `getPlaylist`) are NOT audited.

Structured INFO log on every mutation: `op=playlist.<verb> playlistId=… actor=… outcome=ok|fail`.

---

## Test plan

### `MusicPlaylistServiceTest` — pure unit, mocked repos (6 cases)

1. `createPlaylist` happy path → saves entity, returns DTO with trackCount=0
2. `createPlaylist` blank name → throws `PlaylistException("invalid_name")`
3. `createPlaylist` duplicate name (case-insensitive) → throws `PlaylistException("duplicate_name")`
4. `addTrack` to empty playlist → sort_order=0
5. `addTrack` to playlist with 3 tracks → sort_order=3 (appended)
6. `removeTrack` from middle → remaining tracks recompacted (0,1,2 from 0,2,3)
7. `reorderTracks` mismatched ids → throws `PlaylistException("invalid_order")`
8. `deletePlaylist` not found → throws `PlaylistException("playlist_not_found")`

### `MusicPlaylistControllerTest` — pure unit, mocked service (4 cases)

1. `GET /playlists` → 200 + array
2. `POST /playlists` valid → 201 + dto
3. `POST /playlists` duplicate → 409 `{error:"duplicate_name"}`
4. `GET /playlists/{id}` not found → 404 `{error:"playlist_not_found"}`

**No integration tests** (per project memory: `*IT.java` doesn't run reliably in this project).

---

## Tasks (TDD order)

1. **V033 migration** — write SQL, run `mvn -pl app -DskipTests compile`, verify no errors. Commit.
2. **Entities + repos** (no tests yet, scaffolding only). Compile. Commit.
3. **DTOs + Request records + PlaylistException**. Compile. Commit.
4. **`MusicPlaylistServiceTest` — RED** (write all 8 tests, run, expect failures because service doesn't exist).
5. **`MusicPlaylistService` — GREEN** (implement, run tests until all pass).
6. **`MusicPlaylistControllerTest` — RED**.
7. **`MusicPlaylistController` — GREEN**.
8. **Final test run** — `mvn -pl app test` — assert v1's 9 + v2's ~12 all green.
9. **Dispatch log** — write to `docs/dispatch-log/music-v2-backend-<UTC>.md` and commit.

Each task commits with `[milestone:music][task:v2-N]` and `Refs: docs/superpowers/specs/2026-05-18-music-player-v2-addendum.md`.

---

## Out of scope (for this plan)

- Frontend (design-blocked)
- localStorage persistence module (frontend concern)
- MusicProvider context refactor (frontend concern)
- Mini-player UI (design-blocked)
- Any change to existing `MusicController` / `YoutubeSearchService` / `MusicTrackDto`
