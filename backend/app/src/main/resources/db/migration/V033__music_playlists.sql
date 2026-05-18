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
