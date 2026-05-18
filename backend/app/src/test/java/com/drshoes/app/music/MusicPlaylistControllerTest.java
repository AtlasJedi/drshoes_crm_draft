package com.drshoes.app.music;

import com.drshoes.app.auth.principal.AdminPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Pure unit tests for MusicPlaylistController — service mocked.
 * Four cases per the v2 backend plan.
 */
class MusicPlaylistControllerTest {

    private MusicPlaylistService service;
    private MusicPlaylistController controller;
    private AdminPrincipal actor;

    @BeforeEach
    void setUp() {
        service    = mock(MusicPlaylistService.class);
        controller = new MusicPlaylistController(service);
        actor      = new AdminPrincipal(UUID.randomUUID(), "admin@test.pl", "ADMIN");
    }

    @Test
    void listPlaylists_returns200WithArray() {
        PlaylistDto dto = new PlaylistDto(UUID.randomUUID(), "Chill", 3, Instant.now(), null);
        when(service.listPlaylists()).thenReturn(List.of(dto));

        ResponseEntity<?> r = controller.listPlaylists(actor);

        assertThat(r.getStatusCode()).isEqualTo(HttpStatus.OK);
        @SuppressWarnings("unchecked")
        List<PlaylistDto> body = (List<PlaylistDto>) r.getBody();
        assertThat(body).hasSize(1);
        assertThat(body.get(0).name()).isEqualTo("Chill");
    }

    @Test
    void createPlaylist_validName_returns201WithDto() {
        UUID id = UUID.randomUUID();
        PlaylistDto dto = new PlaylistDto(id, "New Playlist", 0, Instant.now(), null);
        when(service.createPlaylist(eq("New Playlist"))).thenReturn(dto);

        var req = new PlaylistRequests.CreatePlaylistRequest("New Playlist");
        ResponseEntity<?> r = controller.createPlaylist(req, actor);

        assertThat(r.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(((PlaylistDto) r.getBody()).id()).isEqualTo(id);
    }

    @Test
    void createPlaylist_duplicateName_returns409WithError() {
        when(service.createPlaylist(eq("Taken Name")))
            .thenThrow(new PlaylistException(PlaylistException.DUPLICATE_NAME));

        var req = new PlaylistRequests.CreatePlaylistRequest("Taken Name");
        ResponseEntity<?> r = controller.createPlaylist(req, actor);

        assertThat(r.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(((Map<?, ?>) r.getBody()).get("error")).isEqualTo("duplicate_name");
    }

    @Test
    void getPlaylist_notFound_returns404WithError() {
        UUID id = UUID.randomUUID();
        when(service.getPlaylist(id))
            .thenThrow(new PlaylistException(PlaylistException.NOT_FOUND));

        ResponseEntity<?> r = controller.getPlaylist(id, actor);

        assertThat(r.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(((Map<?, ?>) r.getBody()).get("error")).isEqualTo("playlist_not_found");
    }
}
