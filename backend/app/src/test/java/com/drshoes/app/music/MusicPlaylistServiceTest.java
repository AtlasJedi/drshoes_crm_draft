package com.drshoes.app.music;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.*;

/**
 * Pure unit tests for MusicPlaylistService — all repos mocked.
 * Eight test cases per the v2 backend plan.
 */
class MusicPlaylistServiceTest {

    private MusicPlaylistRepository playlistRepo;
    private MusicPlaylistTrackRepository trackRepo;
    private MusicPlaylistService service;

    @BeforeEach
    void setUp() {
        playlistRepo = mock(MusicPlaylistRepository.class);
        trackRepo    = mock(MusicPlaylistTrackRepository.class);
        service      = new MusicPlaylistService(playlistRepo, trackRepo);
    }

    // ---- createPlaylist ----

    @Test
    void createPlaylist_happyPath_savesAndReturnsDtoWithTrackCountZero() {
        when(playlistRepo.findByNameIgnoreCase("Chill Beats")).thenReturn(Optional.empty());
        when(playlistRepo.save(any(MusicPlaylist.class))).thenAnswer(inv -> {
            MusicPlaylist p = inv.getArgument(0);
            return p; // simulate save, no id set but entity returned
        });

        PlaylistDto result = service.createPlaylist("Chill Beats");

        assertThat(result.name()).isEqualTo("Chill Beats");
        assertThat(result.trackCount()).isEqualTo(0);
        verify(playlistRepo).save(argThat(p -> "Chill Beats".equals(p.getName())));
    }

    @Test
    void createPlaylist_blankName_throwsInvalidName() {
        assertThatThrownBy(() -> service.createPlaylist("  "))
            .isInstanceOf(PlaylistException.class)
            .satisfies(e -> assertThat(((PlaylistException) e).code())
                .isEqualTo(PlaylistException.INVALID_NAME));
    }

    @Test
    void createPlaylist_duplicateNameCaseInsensitive_throwsDuplicateName() {
        MusicPlaylist existing = new MusicPlaylist("Chill Beats");
        when(playlistRepo.findByNameIgnoreCase("chill beats")).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> service.createPlaylist("chill beats"))
            .isInstanceOf(PlaylistException.class)
            .satisfies(e -> assertThat(((PlaylistException) e).code())
                .isEqualTo(PlaylistException.DUPLICATE_NAME));
    }

    // ---- addTrack ----

    @Test
    void addTrack_toEmptyPlaylist_sortOrderZero() {
        UUID playlistId = UUID.randomUUID();
        MusicPlaylist playlist = new MusicPlaylist("My Playlist");

        when(playlistRepo.findById(playlistId)).thenReturn(Optional.of(playlist));
        when(trackRepo.findTopByPlaylistIdOrderBySortOrderDesc(playlistId)).thenReturn(Optional.empty());
        when(trackRepo.save(any(MusicPlaylistTrack.class))).thenAnswer(inv -> inv.getArgument(0));

        PlaylistTrackDto result = service.addTrack(
            playlistId, "vid001", "Track A", "Chan X", "https://t/a.jpg"
        );

        assertThat(result.sortOrder()).isEqualTo(0);
        assertThat(result.videoId()).isEqualTo("vid001");
    }

    @Test
    void addTrack_toPlaylistWithThreeTracks_sortOrderThree() {
        UUID playlistId = UUID.randomUUID();
        MusicPlaylist playlist = new MusicPlaylist("My Playlist");

        MusicPlaylistTrack lastTrack = new MusicPlaylistTrack(
            playlist, "vid003", "Track C", "Chan Y", null, 2);
        when(playlistRepo.findById(playlistId)).thenReturn(Optional.of(playlist));
        when(trackRepo.findTopByPlaylistIdOrderBySortOrderDesc(playlistId))
            .thenReturn(Optional.of(lastTrack));
        when(trackRepo.save(any(MusicPlaylistTrack.class))).thenAnswer(inv -> inv.getArgument(0));

        PlaylistTrackDto result = service.addTrack(
            playlistId, "vid004", "Track D", "Chan X", null
        );

        assertThat(result.sortOrder()).isEqualTo(3);
    }

    // ---- removeTrack ----

    @Test
    void removeTrack_fromMiddle_remainingTracksRecompacted() {
        UUID playlistId = UUID.randomUUID();
        UUID trackId    = UUID.randomUUID();

        MusicPlaylist playlist = new MusicPlaylist("My Playlist");

        // Tracks with sort_order 0, 1 (the one to delete), 2
        MusicPlaylistTrack t0 = makeTrack(playlist, UUID.randomUUID(), "v0", 0);
        MusicPlaylistTrack t1 = makeTrack(playlist, trackId,            "v1", 1);
        MusicPlaylistTrack t2 = makeTrack(playlist, UUID.randomUUID(), "v2", 2);

        when(playlistRepo.findById(playlistId)).thenReturn(Optional.of(playlist));
        when(trackRepo.findByIdAndPlaylistId(trackId, playlistId)).thenReturn(Optional.of(t1));
        when(trackRepo.findByPlaylistIdOrderBySortOrderAsc(playlistId))
            .thenReturn(new ArrayList<>(List.of(t0, t1, t2)));

        service.removeTrack(playlistId, trackId);

        // After removing t1 (index 1), t2 should shift from sort_order=2 to sort_order=1
        verify(trackRepo).delete(t1);
        verify(trackRepo, atLeastOnce()).save(any(MusicPlaylistTrack.class));
        // t0 stays at 0, t2 shifts to 1
        assertThat(t0.getSortOrder()).isEqualTo(0);
        assertThat(t2.getSortOrder()).isEqualTo(1);
    }

    // ---- reorderTracks ----

    @Test
    void reorderTracks_mismatchedIds_throwsInvalidOrder() {
        UUID playlistId = UUID.randomUUID();
        UUID idA = UUID.randomUUID();
        UUID idB = UUID.randomUUID();

        MusicPlaylist playlist = new MusicPlaylist("My Playlist");
        when(playlistRepo.findById(playlistId)).thenReturn(Optional.of(playlist));

        MusicPlaylistTrack tA = makeTrack(playlist, idA, "vA", 0);
        MusicPlaylistTrack tB = makeTrack(playlist, idB, "vB", 1);
        when(trackRepo.findByPlaylistIdOrderBySortOrderAsc(playlistId))
            .thenReturn(List.of(tA, tB));

        // Supply a foreign ID — mismatch
        UUID foreignId = UUID.randomUUID();
        assertThatThrownBy(() -> service.reorderTracks(playlistId, List.of(idA, foreignId)))
            .isInstanceOf(PlaylistException.class)
            .satisfies(e -> assertThat(((PlaylistException) e).code())
                .isEqualTo(PlaylistException.INVALID_ORDER));
    }

    // ---- deletePlaylist ----

    @Test
    void deletePlaylist_notFound_throwsPlaylistNotFound() {
        UUID id = UUID.randomUUID();
        when(playlistRepo.findById(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.deletePlaylist(id))
            .isInstanceOf(PlaylistException.class)
            .satisfies(e -> assertThat(((PlaylistException) e).code())
                .isEqualTo(PlaylistException.NOT_FOUND));
    }

    // ---- helpers ----

    private MusicPlaylistTrack makeTrack(MusicPlaylist playlist, UUID id, String videoId, int order) {
        // Use reflection to simulate JPA-assigned id (no no-arg constructor we can call)
        MusicPlaylistTrack t = new MusicPlaylistTrack(playlist, videoId, "Title " + videoId,
            "Channel", null, order);
        // Inject id via field reflection (entity uses @GeneratedValue; unit tests bypass JPA)
        try {
            var f = MusicPlaylistTrack.class.getDeclaredField("id");
            f.setAccessible(true);
            f.set(t, id);
        } catch (Exception ex) {
            throw new RuntimeException(ex);
        }
        return t;
    }
}
