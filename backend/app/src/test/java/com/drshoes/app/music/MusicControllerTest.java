package com.drshoes.app.music;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class MusicControllerTest {

    @Test
    void happyPathReturnsTracks() {
        var svc = mock(YoutubeSearchService.class);
        when(svc.search(eq("lofi"))).thenReturn(List.of(
            new MusicTrackDto("v1", "Title 1", "Chan 1", "https://t/1.jpg"),
            new MusicTrackDto("v2", "Title 2", "Chan 2", "https://t/2.jpg")
        ));
        var ctrl = new MusicController(svc);

        ResponseEntity<?> r = ctrl.search("lofi");

        assertThat(r.getStatusCode()).isEqualTo(HttpStatus.OK);
        @SuppressWarnings("unchecked")
        List<MusicTrackDto> body = (List<MusicTrackDto>) r.getBody();
        assertThat(body).hasSize(2);
        assertThat(body.get(0).videoId()).isEqualTo("v1");
    }

    @Test
    void blankQueryReturns400InvalidQuery() {
        var ctrl = new MusicController(mock(YoutubeSearchService.class));

        ResponseEntity<?> r = ctrl.search("   ");

        assertThat(r.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(((Map<?, ?>) r.getBody()).get("error")).isEqualTo("invalid_query");
    }

    @Test
    void tooLongQueryReturns400InvalidQuery() {
        var ctrl = new MusicController(mock(YoutubeSearchService.class));

        ResponseEntity<?> r = ctrl.search("x".repeat(101));

        assertThat(r.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(((Map<?, ?>) r.getBody()).get("error")).isEqualTo("invalid_query");
    }

    @Test
    void serviceDisabledReturns503() {
        var svc = mock(YoutubeSearchService.class);
        when(svc.search(eq("ok"))).thenThrow(new MusicSearchException(
            MusicSearchException.CODE_DISABLED, "no key"));
        var ctrl = new MusicController(svc);

        ResponseEntity<?> r = ctrl.search("ok");

        assertThat(r.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(((Map<?, ?>) r.getBody()).get("error")).isEqualTo("music_disabled");
    }

    @Test
    void serviceFailureReturns502() {
        var svc = mock(YoutubeSearchService.class);
        when(svc.search(eq("ok"))).thenThrow(new MusicSearchException(
            MusicSearchException.CODE_FAILED, "boom"));
        var ctrl = new MusicController(svc);

        ResponseEntity<?> r = ctrl.search("ok");

        assertThat(r.getStatusCode()).isEqualTo(HttpStatus.BAD_GATEWAY);
        assertThat(((Map<?, ?>) r.getBody()).get("error")).isEqualTo("music_search_failed");
    }
}
