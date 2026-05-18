package com.drshoes.app.music;

import java.util.List;
import java.util.UUID;

/**
 * Nested request record classes for playlist CRUD endpoints.
 * All are deserialized by Spring MVC's @RequestBody / Jackson.
 */
public final class PlaylistRequests {

    private PlaylistRequests() {}

    /** POST /api/admin/music/playlists */
    public record CreatePlaylistRequest(String name) {}

    /** PATCH /api/admin/music/playlists/{id} */
    public record RenamePlaylistRequest(String name) {}

    /** POST /api/admin/music/playlists/{id}/tracks */
    public record AddTrackRequest(
        String videoId,
        String title,
        String channelTitle,
        String thumbnailUrl
    ) {}

    /** PATCH /api/admin/music/playlists/{id}/tracks */
    public record ReorderTracksRequest(List<UUID> trackIds) {}
}
