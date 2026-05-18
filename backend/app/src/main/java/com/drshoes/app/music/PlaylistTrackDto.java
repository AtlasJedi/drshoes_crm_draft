package com.drshoes.app.music;

import java.util.UUID;

/**
 * Immutable DTO representing a single playlist track.
 * Returned by add-track (201) and reorder (200) endpoints.
 */
public record PlaylistTrackDto(
    UUID id,
    String videoId,
    String title,
    String channelTitle,
    String thumbnailUrl,
    int sortOrder
) {

    public static PlaylistTrackDto from(MusicPlaylistTrack t) {
        return new PlaylistTrackDto(
            t.getId(),
            t.getVideoId(),
            t.getTitle(),
            t.getChannelTitle(),
            t.getThumbnailUrl(),
            t.getSortOrder()
        );
    }
}
