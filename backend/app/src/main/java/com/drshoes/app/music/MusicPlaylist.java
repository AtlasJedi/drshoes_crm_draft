package com.drshoes.app.music;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * JPA entity for a shared workshop music playlist.
 *
 * One playlist pool for the whole admin team — no per-user partitioning
 * (locked in 2026-05-18-music-player-v2-addendum.md).
 *
 * Tracks are ordered by sort_order ASC. The OneToMany relationship is
 * lazily loaded; the service eagerly fetches when returning full detail.
 */
@Entity
@Table(name = "music_playlist")
public class MusicPlaylist {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @OneToMany(mappedBy = "playlist", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("sortOrder ASC")
    private List<MusicPlaylistTrack> tracks = new ArrayList<>();

    /** JPA no-arg constructor. */
    protected MusicPlaylist() {}

    public MusicPlaylist(String name) {
        this.name = name;
    }

    // --- getters ---

    public UUID getId()             { return id; }
    public String getName()         { return name; }
    public Instant getCreatedAt()   { return createdAt; }
    public Instant getUpdatedAt()   { return updatedAt; }
    public List<MusicPlaylistTrack> getTracks() { return tracks; }

    // --- mutators ---

    public void setName(String name) {
        this.name = name;
    }

    public void touchUpdatedAt() {
        this.updatedAt = Instant.now();
    }
}
