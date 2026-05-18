package com.drshoes.app.music;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * Admin-only search proxy in front of YouTube Data API v3. Returns at most
 * 20 video tracks. Read-only; not @Audited (would spam audit_log per keystroke).
 */
@RestController
@RequestMapping("/api/admin/music")
@PreAuthorize("isAuthenticated()")
public class MusicController {

    private static final Logger LOG = LoggerFactory.getLogger(MusicController.class);
    private static final int MAX_QUERY_LEN = 100;

    private final YoutubeSearchService service;

    public MusicController(YoutubeSearchService service) {
        this.service = service;
    }

    @GetMapping("/search")
    public ResponseEntity<?> search(@RequestParam("q") String q) {
        if (q == null || q.isBlank() || q.length() > MAX_QUERY_LEN) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("error", "invalid_query"));
        }
        try {
            List<MusicTrackDto> tracks = service.search(q.trim());
            LOG.info("op=music.search q=\"{}\" results={} outcome=ok",
                truncate(q, 50), tracks.size());
            return ResponseEntity.ok(tracks);
        } catch (MusicSearchException e) {
            HttpStatus status = MusicSearchException.CODE_DISABLED.equals(e.code())
                ? HttpStatus.SERVICE_UNAVAILABLE
                : HttpStatus.BAD_GATEWAY;
            LOG.warn("op=music.search q=\"{}\" outcome=fail code={} msg={}",
                truncate(q, 50), e.code(), e.getMessage());
            return ResponseEntity.status(status).body(Map.of("error", e.code()));
        }
    }

    private static String truncate(String s, int max) {
        if (s == null) return "";
        return s.length() <= max ? s : s.substring(0, max);
    }
}
