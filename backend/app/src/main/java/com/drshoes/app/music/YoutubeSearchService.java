package com.drshoes.app.music;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

/**
 * Server-side proxy for YouTube Data API v3 {@code search.list}. Keeps the
 * API key off the wire to the browser. Read-only — no audit row per call.
 */
@Service
public class YoutubeSearchService {

    private static final Logger LOG = LoggerFactory.getLogger(YoutubeSearchService.class);
    private static final String BASE = "https://www.googleapis.com/youtube/v3/search";
    private static final int MAX_RESULTS = 20;

    private final String apiKey;
    private final HttpClient http;
    private final ObjectMapper mapper;

    @Autowired
    public YoutubeSearchService(
            @Value("${drshoes.music.youtube-api-key:}") String apiKey,
            ObjectMapper mapper) {
        this(apiKey, HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build(), mapper);
    }

    // Test-only / explicit constructor.
    YoutubeSearchService(String apiKey, HttpClient http, ObjectMapper mapper) {
        this.apiKey = apiKey == null ? "" : apiKey;
        this.http = http;
        this.mapper = mapper;
    }

    public List<MusicTrackDto> search(String query) {
        if (apiKey.isBlank()) {
            throw new MusicSearchException(MusicSearchException.CODE_DISABLED,
                "YOUTUBE_API_KEY not configured");
        }
        URI uri = URI.create(BASE
            + "?part=snippet"
            + "&type=video"
            + "&videoCategoryId=10"
            + "&maxResults=" + MAX_RESULTS
            + "&q=" + URLEncoder.encode(query, StandardCharsets.UTF_8)
            + "&key=" + URLEncoder.encode(apiKey, StandardCharsets.UTF_8));
        HttpRequest req = HttpRequest.newBuilder(uri)
            .timeout(Duration.ofSeconds(5))
            .GET()
            .build();
        HttpResponse<String> resp;
        try {
            resp = http.send(req, HttpResponse.BodyHandlers.ofString());
        } catch (Exception e) {
            throw new MusicSearchException(MusicSearchException.CODE_FAILED,
                "upstream call failed", e);
        }
        if (resp.statusCode() != 200) {
            LOG.warn("op=youtube.search outcome=upstream_fail status={} body_len={}",
                resp.statusCode(), resp.body() == null ? 0 : resp.body().length());
            throw new MusicSearchException(MusicSearchException.CODE_FAILED,
                "upstream status " + resp.statusCode());
        }
        try {
            return parse(resp.body());
        } catch (Exception e) {
            throw new MusicSearchException(MusicSearchException.CODE_FAILED,
                "parse failure", e);
        }
    }

    private List<MusicTrackDto> parse(String body) throws Exception {
        JsonNode root = mapper.readTree(body);
        JsonNode items = root.path("items");
        List<MusicTrackDto> out = new ArrayList<>();
        for (JsonNode item : items) {
            JsonNode id = item.path("id");
            String kind = id.path("kind").asText("");
            String videoId = id.path("videoId").asText("");
            if (!"youtube#video".equals(kind) || videoId.isBlank()) {
                continue;
            }
            JsonNode snippet = item.path("snippet");
            String title = snippet.path("title").asText("");
            String channelTitle = snippet.path("channelTitle").asText("");
            JsonNode thumbs = snippet.path("thumbnails");
            String thumb = thumbs.path("medium").path("url").asText("");
            if (thumb.isBlank()) {
                thumb = thumbs.path("default").path("url").asText("");
            }
            out.add(new MusicTrackDto(videoId, title, channelTitle, thumb));
        }
        return out;
    }
}
