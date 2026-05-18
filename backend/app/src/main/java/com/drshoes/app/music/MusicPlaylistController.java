package com.drshoes.app.music;

import com.drshoes.app.auth.principal.AdminPrincipal;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Admin REST controller for shared music playlist CRUD.
 *
 * All endpoints are under /api/admin/music/playlists and require an
 * authenticated admin session. The @PreAuthorize is redundant with
 * SecurityConfig but kept as belt-and-suspenders per project pattern.
 *
 * Error mapping:
 *   PlaylistException(invalid_name)   → 400
 *   PlaylistException(duplicate_name) → 409
 *   PlaylistException(playlist_not_found | track_not_found) → 404
 *   PlaylistException(invalid_order)  → 400
 */
@RestController
@RequestMapping("/api/admin/music/playlists")
@PreAuthorize("isAuthenticated()")
public class MusicPlaylistController {

    private static final Logger LOG = LoggerFactory.getLogger(MusicPlaylistController.class);

    private final MusicPlaylistService service;

    public MusicPlaylistController(MusicPlaylistService service) {
        this.service = service;
    }

    /** GET /api/admin/music/playlists — list all playlists, no tracks inline. */
    @GetMapping
    public ResponseEntity<?> listPlaylists(@AuthenticationPrincipal AdminPrincipal actor) {
        LOG.info("op=playlist.list actor={}", actor.email());
        List<PlaylistDto> result = service.listPlaylists();
        return ResponseEntity.ok(result);
    }

    /** GET /api/admin/music/playlists/{id} — single playlist with tracks. */
    @GetMapping("/{id}")
    public ResponseEntity<?> getPlaylist(@PathVariable UUID id,
                                         @AuthenticationPrincipal AdminPrincipal actor) {
        LOG.info("op=playlist.get playlistId={} actor={}", id, actor.email());
        try {
            return ResponseEntity.ok(service.getPlaylist(id));
        } catch (PlaylistException e) {
            return errorResponse(e);
        }
    }

    /** POST /api/admin/music/playlists — create playlist (201). */
    @PostMapping
    public ResponseEntity<?> createPlaylist(@RequestBody PlaylistRequests.CreatePlaylistRequest req,
                                            @AuthenticationPrincipal AdminPrincipal actor) {
        LOG.info("op=playlist.create actor={}", actor.email());
        try {
            PlaylistDto dto = service.createPlaylist(req.name());
            return ResponseEntity.status(HttpStatus.CREATED).body(dto);
        } catch (PlaylistException e) {
            return errorResponse(e);
        }
    }

    /** PATCH /api/admin/music/playlists/{id} — rename playlist (200). */
    @PatchMapping("/{id}")
    public ResponseEntity<?> renamePlaylist(@PathVariable UUID id,
                                            @RequestBody PlaylistRequests.RenamePlaylistRequest req,
                                            @AuthenticationPrincipal AdminPrincipal actor) {
        LOG.info("op=playlist.rename playlistId={} actor={}", id, actor.email());
        try {
            return ResponseEntity.ok(service.renamePlaylist(id, req.name(), actor.email()));
        } catch (PlaylistException e) {
            return errorResponse(e);
        }
    }

    /** DELETE /api/admin/music/playlists/{id} — delete playlist (204). */
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deletePlaylist(@PathVariable UUID id,
                                            @AuthenticationPrincipal AdminPrincipal actor) {
        LOG.info("op=playlist.delete playlistId={} actor={}", id, actor.email());
        try {
            service.deletePlaylist(id);
            return ResponseEntity.noContent().build();
        } catch (PlaylistException e) {
            return errorResponse(e);
        }
    }

    /** POST /api/admin/music/playlists/{id}/tracks — add track (201). */
    @PostMapping("/{id}/tracks")
    public ResponseEntity<?> addTrack(@PathVariable UUID id,
                                      @RequestBody PlaylistRequests.AddTrackRequest req,
                                      @AuthenticationPrincipal AdminPrincipal actor) {
        LOG.info("op=playlist.addTrack playlistId={} actor={}", id, actor.email());
        try {
            PlaylistTrackDto dto = service.addTrack(
                id, req.videoId(), req.title(), req.channelTitle(), req.thumbnailUrl()
            );
            return ResponseEntity.status(HttpStatus.CREATED).body(dto);
        } catch (PlaylistException e) {
            return errorResponse(e);
        }
    }

    /** DELETE /api/admin/music/playlists/{id}/tracks/{trackId} — remove track (204). */
    @DeleteMapping("/{id}/tracks/{trackId}")
    public ResponseEntity<?> removeTrack(@PathVariable UUID id,
                                         @PathVariable UUID trackId,
                                         @AuthenticationPrincipal AdminPrincipal actor) {
        LOG.info("op=playlist.removeTrack playlistId={} trackId={} actor={}", id, trackId, actor.email());
        try {
            service.removeTrack(id, trackId);
            return ResponseEntity.noContent().build();
        } catch (PlaylistException e) {
            return errorResponse(e);
        }
    }

    /** PATCH /api/admin/music/playlists/{id}/tracks — reorder tracks (200, full list). */
    @PatchMapping("/{id}/tracks")
    public ResponseEntity<?> reorderTracks(@PathVariable UUID id,
                                           @RequestBody PlaylistRequests.ReorderTracksRequest req,
                                           @AuthenticationPrincipal AdminPrincipal actor) {
        LOG.info("op=playlist.reorder playlistId={} count={} actor={}",
            id, req.trackIds() == null ? 0 : req.trackIds().size(), actor.email());
        try {
            List<PlaylistTrackDto> result = service.reorderTracks(id, req.trackIds());
            return ResponseEntity.ok(result);
        } catch (PlaylistException e) {
            return errorResponse(e);
        }
    }

    // ---- private helpers ----

    private ResponseEntity<Map<String, String>> errorResponse(PlaylistException e) {
        HttpStatus status = switch (e.code()) {
            case PlaylistException.DUPLICATE_NAME -> HttpStatus.CONFLICT;
            case PlaylistException.NOT_FOUND, PlaylistException.TRACK_NOT_FOUND -> HttpStatus.NOT_FOUND;
            default -> HttpStatus.BAD_REQUEST; // invalid_name, invalid_order
        };
        return ResponseEntity.status(status).body(Map.of("error", e.code()));
    }
}
