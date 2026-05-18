package com.drshoes.app.music;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

/**
 * JPA entity for a single track inside a shared music playlist.
 *
 * Title, channelTitle, and thumbnailUrl are cached at add-time because
 * YouTube doesn't guarantee their persistence (thumbnails may 404 later).
 *
 * sort_order determines play order within the playlist. Recompaction
 * (0-based contiguous) is applied after every remove and reorder.
 */
@Entity
@Table(name = "music_playlist_track")
public class MusicPlaylistTrack {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "playlist_id", nullable = false)
    private MusicPlaylist playlist;

    @Column(name = "video_id", nullable = false, length = 32)
    private String videoId;

    @Column(nullable = false, length = 500)
    private String title;

    @Column(name = "channel_title", nullable = false, length = 200)
    private String channelTitle;

    @Column(name = "thumbnail_url", length = 500)
    private String thumbnailUrl;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(name = "added_at", nullable = false)
    private Instant addedAt = Instant.now();

    /** JPA no-arg constructor. */
    protected MusicPlaylistTrack() {}

    public MusicPlaylistTrack(MusicPlaylist playlist,
                              String videoId,
                              String title,
                              String channelTitle,
                              String thumbnailUrl,
                              int sortOrder) {
        this.playlist      = playlist;
        this.videoId       = videoId;
        this.title         = title;
        this.channelTitle  = channelTitle;
        this.thumbnailUrl  = thumbnailUrl;
        this.sortOrder     = sortOrder;
    }

    // --- getters ---

    public UUID getId()              { return id; }
    public MusicPlaylist getPlaylist() { return playlist; }
    public String getVideoId()       { return videoId; }
    public String getTitle()         { return title; }
    public String getChannelTitle()  { return channelTitle; }
    public String getThumbnailUrl()  { return thumbnailUrl; }
    public int getSortOrder()        { return sortOrder; }
    public Instant getAddedAt()      { return addedAt; }

    // --- mutators ---

    public void setSortOrder(int sortOrder) {
        this.sortOrder = sortOrder;
    }
}
