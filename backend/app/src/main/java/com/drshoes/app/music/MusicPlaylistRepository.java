package com.drshoes.app.music;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Spring Data JPA repository for {@link MusicPlaylist}.
 *
 * findByNameIgnoreCase supports case-insensitive duplicate-name checks in the
 * service layer (avoids a LOWER() functional index in the DB).
 */
public interface MusicPlaylistRepository extends JpaRepository<MusicPlaylist, UUID> {

    /** Used by the list endpoint: newest updates first. */
    List<MusicPlaylist> findAllByOrderByUpdatedAtDesc();

    /** Case-insensitive lookup for duplicate-name validation. */
    Optional<MusicPlaylist> findByNameIgnoreCase(String name);
}
