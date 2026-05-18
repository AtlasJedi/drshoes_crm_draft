package com.drshoes.app.music;

import com.drshoes.app.audit.Audited;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * CRUD service for shared workshop music playlists.
 *
 * All mutating methods:
 *   - validate inputs (name non-blank, length, uniqueness)
 *   - touch playlist.updatedAt
 *   - carry @Audited(parent=) so AuditLogAspect logs the operation
 *   - emit structured INFO log: op=playlist.<verb> playlistId=… actor=… outcome=ok|fail
 *
 * Actor resolution: callers pass actor email string; the controller extracts it
 * from AdminPrincipal before delegating to avoid the service depending on the
 * Security context directly.
 *
 * ReorderTracks: validates that the supplied UUID list is an exact set-match with
 * current track ids (no extras, no missing). Sort_order is reassigned to array index.
 *
 * RemoveTrack: deletes the target track then recompacts sort_order on remaining
 * tracks (0-based contiguous) within the same transaction.
 */
@Service
public class MusicPlaylistService {

    private static final Logger LOG = LoggerFactory.getLogger(MusicPlaylistService.class);
    private static final int MAX_NAME_LEN = 120;

    private final MusicPlaylistRepository playlistRepo;
    private final MusicPlaylistTrackRepository trackRepo;

    public MusicPlaylistService(MusicPlaylistRepository playlistRepo,
                                MusicPlaylistTrackRepository trackRepo) {
        this.playlistRepo = playlistRepo;
        this.trackRepo    = trackRepo;
    }

    // ---- read operations (not @Audited) ----

    @Transactional(readOnly = true)
    public List<PlaylistDto> listPlaylists() {
        return playlistRepo.findAllByOrderByUpdatedAtDesc().stream()
            .map(PlaylistDto::summary)
            .toList();
    }

    @Transactional(readOnly = true)
    public PlaylistDto getPlaylist(UUID id) {
        MusicPlaylist p = requirePlaylist(id);
        // Force-load lazy tracks within the transaction
        p.getTracks().size();
        return PlaylistDto.detail(p);
    }

    // ---- mutating operations ----

    @Audited(parent = "#result.id")
    @Transactional
    public PlaylistDto createPlaylist(String name) {
        validateName(name);
        if (playlistRepo.findByNameIgnoreCase(name).isPresent()) {
            LOG.warn("op=playlist.create name=\"{}\" outcome=fail reason=duplicate", name);
            throw new PlaylistException(PlaylistException.DUPLICATE_NAME);
        }
        MusicPlaylist playlist = new MusicPlaylist(name);
        playlistRepo.save(playlist);
        LOG.info("op=playlist.create playlistId={} outcome=ok", playlist.getId());
        return PlaylistDto.summary(playlist);
    }

    @Audited(parent = "#id")
    @Transactional
    public PlaylistDto renamePlaylist(UUID id, String name, String actor) {
        validateName(name);
        MusicPlaylist playlist = requirePlaylist(id);
        // Case-insensitive duplicate check — allow keeping the same name (renaming to itself)
        playlistRepo.findByNameIgnoreCase(name).ifPresent(existing -> {
            if (!existing.getId().equals(id)) {
                LOG.warn("op=playlist.rename playlistId={} actor={} outcome=fail reason=duplicate",
                    id, actor);
                throw new PlaylistException(PlaylistException.DUPLICATE_NAME);
            }
        });
        playlist.setName(name);
        playlist.touchUpdatedAt();
        playlistRepo.save(playlist);
        LOG.info("op=playlist.rename playlistId={} actor={} outcome=ok", id, actor);
        // Force-load tracks for DTO
        playlist.getTracks().size();
        return PlaylistDto.summary(playlist);
    }

    @Audited(parent = "#id")
    @Transactional
    public void deletePlaylist(UUID id) {
        MusicPlaylist playlist = requirePlaylist(id);
        playlistRepo.delete(playlist);
        LOG.info("op=playlist.delete playlistId={} outcome=ok", id);
    }

    @Audited(parent = "#playlistId")
    @Transactional
    public PlaylistTrackDto addTrack(UUID playlistId,
                                    String videoId,
                                    String title,
                                    String channelTitle,
                                    String thumbnailUrl) {
        MusicPlaylist playlist = requirePlaylist(playlistId);
        int nextOrder = trackRepo.findTopByPlaylistIdOrderBySortOrderDesc(playlistId)
            .map(last -> last.getSortOrder() + 1)
            .orElse(0);
        MusicPlaylistTrack track = new MusicPlaylistTrack(
            playlist, videoId, title, channelTitle, thumbnailUrl, nextOrder
        );
        trackRepo.save(track);
        playlist.touchUpdatedAt();
        playlistRepo.save(playlist);
        LOG.info("op=playlist.addTrack playlistId={} trackId={} sortOrder={} outcome=ok",
            playlistId, track.getId(), nextOrder);
        return PlaylistTrackDto.from(track);
    }

    @Audited(parent = "#playlistId")
    @Transactional
    public void removeTrack(UUID playlistId, UUID trackId) {
        requirePlaylist(playlistId);
        MusicPlaylistTrack track = trackRepo.findByIdAndPlaylistId(trackId, playlistId)
            .orElseThrow(() -> new PlaylistException(PlaylistException.TRACK_NOT_FOUND));
        trackRepo.delete(track);
        // Recompact sort_order on remaining tracks
        List<MusicPlaylistTrack> remaining = new ArrayList<>(
            trackRepo.findByPlaylistIdOrderBySortOrderAsc(playlistId)
        );
        remaining.remove(track);
        for (int i = 0; i < remaining.size(); i++) {
            MusicPlaylistTrack t = remaining.get(i);
            if (t.getSortOrder() != i) {
                t.setSortOrder(i);
                trackRepo.save(t);
            }
        }
        MusicPlaylist playlist = requirePlaylist(playlistId);
        playlist.touchUpdatedAt();
        playlistRepo.save(playlist);
        LOG.info("op=playlist.removeTrack playlistId={} trackId={} outcome=ok", playlistId, trackId);
    }

    @Audited(parent = "#playlistId")
    @Transactional
    public List<PlaylistTrackDto> reorderTracks(UUID playlistId, List<UUID> trackIds) {
        requirePlaylist(playlistId);
        List<MusicPlaylistTrack> current =
            trackRepo.findByPlaylistIdOrderBySortOrderAsc(playlistId);

        // Validate exact set match
        Set<UUID> currentIds = new HashSet<>();
        for (MusicPlaylistTrack t : current) currentIds.add(t.getId());
        Set<UUID> requestedIds = new HashSet<>(trackIds);
        if (!currentIds.equals(requestedIds) || trackIds.size() != current.size()) {
            throw new PlaylistException(PlaylistException.INVALID_ORDER);
        }

        // Build id → entity map, assign new sort_order
        java.util.Map<UUID, MusicPlaylistTrack> byId = new java.util.HashMap<>();
        for (MusicPlaylistTrack t : current) byId.put(t.getId(), t);

        List<MusicPlaylistTrack> reordered = new ArrayList<>();
        for (int i = 0; i < trackIds.size(); i++) {
            MusicPlaylistTrack t = byId.get(trackIds.get(i));
            t.setSortOrder(i);
            trackRepo.save(t);
            reordered.add(t);
        }

        MusicPlaylist playlist = requirePlaylist(playlistId);
        playlist.touchUpdatedAt();
        playlistRepo.save(playlist);
        LOG.info("op=playlist.reorder playlistId={} count={} outcome=ok", playlistId, trackIds.size());
        return reordered.stream().map(PlaylistTrackDto::from).toList();
    }

    // ---- helpers ----

    private MusicPlaylist requirePlaylist(UUID id) {
        return playlistRepo.findById(id)
            .orElseThrow(() -> new PlaylistException(PlaylistException.NOT_FOUND));
    }

    private void validateName(String name) {
        if (name == null || name.isBlank() || name.length() > MAX_NAME_LEN) {
            throw new PlaylistException(PlaylistException.INVALID_NAME);
        }
    }
}
