package com.drshoes.app.music;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Spring Data JPA repository for {@link MusicPlaylistTrack}.
 */
public interface MusicPlaylistTrackRepository extends JpaRepository<MusicPlaylistTrack, UUID> {

    /** All tracks for a playlist ordered by sort_order — used for reorder / remove compaction. */
    List<MusicPlaylistTrack> findByPlaylistIdOrderBySortOrderAsc(UUID playlistId);

    /** Tracks belonging to a specific playlist — used for ownership checks. */
    Optional<MusicPlaylistTrack> findByIdAndPlaylistId(UUID trackId, UUID playlistId);

    /** Last track (highest sort_order) within a playlist — used for append logic. */
    Optional<MusicPlaylistTrack> findTopByPlaylistIdOrderBySortOrderDesc(UUID playlistId);
}
