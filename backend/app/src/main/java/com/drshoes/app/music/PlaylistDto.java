package com.drshoes.app.music;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Immutable DTO for a playlist.
 *
 * List endpoint: tracks is null, trackCount is set.
 * Detail endpoint: tracks is populated (ordered by sort_order), trackCount matches.
 */
public record PlaylistDto(
    UUID id,
    String name,
    int trackCount,
    Instant updatedAt,
    List<PlaylistTrackDto> tracks
) {

    /** Summary (no tracks list) — used by GET /playlists. */
    public static PlaylistDto summary(MusicPlaylist p) {
        return new PlaylistDto(
            p.getId(),
            p.getName(),
            p.getTracks().size(),
            p.getUpdatedAt(),
            null
        );
    }

    /** Full detail (with tracks) — used by GET /playlists/{id}. */
    public static PlaylistDto detail(MusicPlaylist p) {
        List<PlaylistTrackDto> trackDtos = p.getTracks().stream()
            .map(PlaylistTrackDto::from)
            .toList();
        return new PlaylistDto(
            p.getId(),
            p.getName(),
            trackDtos.size(),
            p.getUpdatedAt(),
            trackDtos
        );
    }
}
