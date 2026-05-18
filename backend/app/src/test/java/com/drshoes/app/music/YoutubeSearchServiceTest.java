package com.drshoes.app.music;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class YoutubeSearchServiceTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Test
    void blankApiKeyThrowsDisabled() {
        var svc = new YoutubeSearchService("", mock(HttpClient.class), MAPPER);
        assertThatThrownBy(() -> svc.search("anything"))
            .isInstanceOf(MusicSearchException.class)
            .satisfies(e -> assertThat(((MusicSearchException) e).code())
                .isEqualTo(MusicSearchException.CODE_DISABLED));
    }

    @Test
    void successfulParseReturnsOnlyVideoItems() throws Exception {
        String body = Files.readString(
            Path.of("src/test/resources/fixtures/youtube-search-success.json"),
            StandardCharsets.UTF_8);
        var http = mock(HttpClient.class);
        @SuppressWarnings("unchecked")
        HttpResponse<String> resp = mock(HttpResponse.class);
        when(resp.statusCode()).thenReturn(200);
        when(resp.body()).thenReturn(body);
        @SuppressWarnings({"unchecked", "rawtypes"})
        var stub = (HttpResponse) resp;
        when(http.send(any(HttpRequest.class), any())).thenReturn(stub);

        var svc = new YoutubeSearchService("FAKEKEY", http, MAPPER);

        List<MusicTrackDto> tracks = svc.search("lofi");

        assertThat(tracks).hasSize(2);
        assertThat(tracks.get(0).videoId()).isEqualTo("n61ULEU7CO0");
        assertThat(tracks.get(0).title()).isEqualTo("Best of lofi hip hop 2021");
        assertThat(tracks.get(0).channelTitle()).isEqualTo("Lofi Girl");
        assertThat(tracks.get(0).thumbnailUrl())
            .isEqualTo("https://i.ytimg.com/vi/n61ULEU7CO0/mqdefault.jpg");
        // Second item only has default thumbnail — falls back to it.
        assertThat(tracks.get(1).thumbnailUrl())
            .isEqualTo("https://i.ytimg.com/vi/jfKfPfyJRdk/default.jpg");
    }

    @Test
    void non200UpstreamThrowsFailed() throws Exception {
        var http = mock(HttpClient.class);
        @SuppressWarnings("unchecked")
        HttpResponse<String> resp = mock(HttpResponse.class);
        when(resp.statusCode()).thenReturn(403);
        when(resp.body()).thenReturn("{\"error\":\"forbidden\"}");
        @SuppressWarnings({"unchecked", "rawtypes"})
        var stub403 = (HttpResponse) resp;
        when(http.send(any(HttpRequest.class), any())).thenReturn(stub403);

        var svc = new YoutubeSearchService("FAKEKEY", http, MAPPER);

        assertThatThrownBy(() -> svc.search("lofi"))
            .isInstanceOf(MusicSearchException.class)
            .satisfies(e -> assertThat(((MusicSearchException) e).code())
                .isEqualTo(MusicSearchException.CODE_FAILED));
    }

    @Test
    void malformedJsonThrowsFailed() throws Exception {
        var http = mock(HttpClient.class);
        @SuppressWarnings("unchecked")
        HttpResponse<String> resp = mock(HttpResponse.class);
        when(resp.statusCode()).thenReturn(200);
        when(resp.body()).thenReturn("not valid json at all");
        @SuppressWarnings({"unchecked", "rawtypes"})
        var stubMalformed = (HttpResponse) resp;
        when(http.send(any(HttpRequest.class), any())).thenReturn(stubMalformed);

        var svc = new YoutubeSearchService("FAKEKEY", http, MAPPER);

        assertThatThrownBy(() -> svc.search("lofi"))
            .isInstanceOf(MusicSearchException.class)
            .satisfies(e -> assertThat(((MusicSearchException) e).code())
                .isEqualTo(MusicSearchException.CODE_FAILED));
    }
}
