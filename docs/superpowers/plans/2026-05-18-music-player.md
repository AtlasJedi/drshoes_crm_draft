# Music Player Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/admin/muzyka` — a YouTube search + IFrame player inside the Dr Shoes admin panel — in one feature branch with passing tests, no DB changes, no new backend deps.

**Architecture:** Spring Boot proxies YouTube Data API v3 search (server-side key) → Next.js client page renders results → `react-youtube` plays selected track in an IFrame with custom controls + in-memory auto-advancing queue.

**Tech Stack:**
- Backend: Java 21, Spring Boot 3.4, built-in `java.net.http.HttpClient`, Jackson (already on classpath), JUnit 5 + Mockito
- Frontend: Next.js 16 App Router, TypeScript, Tailwind, `react-youtube` (new dep), Vitest + RTL (already wired)

**Spec:** `docs/superpowers/specs/2026-05-18-music-player-design.md`

**Branch:** `feat/music-player` (already created from `origin/main`, spec committed)

---

## Errata / corrections to the spec

While reading the codebase the following project conventions overrode the spec wording. Apply these in the plan:

1. **Config namespace is `drshoes.*`, not `app.*`.** Spring property = `drshoes.music.youtube-api-key`. Env var still `YOUTUBE_API_KEY`.
2. **Spring config file is `application.yaml`** (not `.yml`).
3. **Controller tests are plain JUnit unit tests** — instantiate `new MusicController(mockService)` directly. The existing test suite uses `@SpringBootTest` for integration; for a tiny controller a unit test is faster and matches what we want.
4. Service tests pass a mocked `HttpClient` via constructor (Mockito mocks the abstract class fine).
5. Sidebar nav: add a new top-level `PRZERWA` section with one `Muzyka` link before `KONFIGURACJA`. Use the exact `SectionLabel` / `NavLink` patterns already in `AdminSidebarNav.tsx`.

---

## File map

### Backend — new package `com.drshoes.app.music`

| File | Responsibility | LOC |
| ---- | -------------- | --- |
| `backend/app/src/main/java/com/drshoes/app/music/MusicTrackDto.java` | Java `record` returned to clients | ≤ 20 |
| `backend/app/src/main/java/com/drshoes/app/music/MusicSearchException.java` | `RuntimeException` with error code | ≤ 25 |
| `backend/app/src/main/java/com/drshoes/app/music/YoutubeSearchService.java` | YouTube Data API v3 call + JSON parse | ≤ 110 |
| `backend/app/src/main/java/com/drshoes/app/music/MusicController.java` | `GET /api/admin/music/search` | ≤ 90 |
| `backend/app/src/test/java/com/drshoes/app/music/YoutubeSearchServiceTest.java` | 4 unit cases | ≤ 130 |
| `backend/app/src/test/java/com/drshoes/app/music/MusicControllerTest.java` | 4 unit cases | ≤ 110 |
| `backend/app/src/test/resources/fixtures/youtube-search-success.json` | Recorded YT response for parser test | ≤ 80 |
| `backend/app/src/main/resources/application.yaml` | Add `drshoes.music.youtube-api-key` binding | +5 |
| `docker-compose.yml` | Add `YOUTUBE_API_KEY` passthrough on `backend` service | +1 |

### Frontend — new route `/admin/muzyka`

| File | Responsibility | LOC |
| ---- | -------------- | --- |
| `apps/web/package.json` | Add `react-youtube` dep | +1 |
| `apps/web/lib/music.ts` | `searchMusic()` fetch wrapper + `Track` type | ≤ 50 |
| `apps/web/app/(admin)/admin/muzyka/page.tsx` | Server shell (metadata only) | ≤ 25 |
| `apps/web/app/(admin)/admin/muzyka/MusicClient.tsx` | Client brain: queue + player wiring | ≤ 180 |
| `apps/web/app/(admin)/admin/muzyka/components/SearchBar.tsx` | Debounced input + results list | ≤ 90 |
| `apps/web/app/(admin)/admin/muzyka/components/PlayerControls.tsx` | Custom play/seek/volume bar | ≤ 110 |
| `apps/web/app/(admin)/admin/muzyka/components/QueueList.tsx` | Up-next strip | ≤ 60 |
| `apps/web/app/(admin)/admin/muzyka/__tests__/MusicClient.test.tsx` | 5 vitest+RTL cases | ≤ 110 |
| `apps/web/components/admin/AdminSidebarNav.tsx` | Add `PRZERWA` section + `Muzyka` link | +6 |

---

## Phase 1 — Backend

### Task 1.1: Create DTO + exception (no tests yet, mechanical)

**Files:**
- Create: `backend/app/src/main/java/com/drshoes/app/music/MusicTrackDto.java`
- Create: `backend/app/src/main/java/com/drshoes/app/music/MusicSearchException.java`

- [ ] **Step 1: Write MusicTrackDto**

```java
package com.drshoes.app.music;

/** Single track returned to the admin music UI. */
public record MusicTrackDto(
    String videoId,
    String title,
    String channelTitle,
    String thumbnailUrl
) {}
```

- [ ] **Step 2: Write MusicSearchException**

```java
package com.drshoes.app.music;

/**
 * Failure inside YouTube search. {@code code} maps directly to the JSON
 * {@code error} field returned by {@link MusicController}.
 */
public class MusicSearchException extends RuntimeException {
    public static final String CODE_DISABLED = "music_disabled";
    public static final String CODE_FAILED = "music_search_failed";

    private final String code;

    public MusicSearchException(String code, String message) {
        super(message);
        this.code = code;
    }

    public MusicSearchException(String code, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
    }

    public String code() {
        return code;
    }
}
```

- [ ] **Step 3: Compile**

Run: `mvn -pl app -DskipTests compile -q`
Expected: BUILD SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add backend/app/src/main/java/com/drshoes/app/music/
git commit -m "feat(music): MusicTrackDto + MusicSearchException scaffold

[milestone:music][task:1.1]
Refs: docs/superpowers/specs/2026-05-18-music-player-design.md"
```

---

### Task 1.2: YoutubeSearchService — RED

**Files:**
- Create: `backend/app/src/test/resources/fixtures/youtube-search-success.json`
- Create: `backend/app/src/test/java/com/drshoes/app/music/YoutubeSearchServiceTest.java`

- [ ] **Step 1: Save the fixture** — a real (trimmed) YT response

Write `youtube-search-success.json` (recorded from a live `q=lofi+beats` call — copy this block verbatim, it's intentionally minimal but valid):

```json
{
  "kind": "youtube#searchListResponse",
  "items": [
    {
      "id": { "kind": "youtube#video", "videoId": "n61ULEU7CO0" },
      "snippet": {
        "title": "Best of lofi hip hop 2021",
        "channelTitle": "Lofi Girl",
        "thumbnails": {
          "default": { "url": "https://i.ytimg.com/vi/n61ULEU7CO0/default.jpg" },
          "medium":  { "url": "https://i.ytimg.com/vi/n61ULEU7CO0/mqdefault.jpg" }
        }
      }
    },
    {
      "id": { "kind": "youtube#video", "videoId": "jfKfPfyJRdk" },
      "snippet": {
        "title": "lofi hip hop radio",
        "channelTitle": "Lofi Girl",
        "thumbnails": {
          "default": { "url": "https://i.ytimg.com/vi/jfKfPfyJRdk/default.jpg" }
        }
      }
    },
    {
      "id": { "kind": "youtube#channel", "channelId": "UCSJ4gkVC6NrvII8umztf0Ow" },
      "snippet": { "title": "Lofi Girl Channel", "channelTitle": "Lofi Girl" }
    }
  ]
}
```

- [ ] **Step 2: Write the failing tests**

```java
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
        when(http.send(any(HttpRequest.class), any())).thenReturn(resp);

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
        when(http.send(any(HttpRequest.class), any())).thenReturn(resp);

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
        when(http.send(any(HttpRequest.class), any())).thenReturn(resp);

        var svc = new YoutubeSearchService("FAKEKEY", http, MAPPER);

        assertThatThrownBy(() -> svc.search("lofi"))
            .isInstanceOf(MusicSearchException.class)
            .satisfies(e -> assertThat(((MusicSearchException) e).code())
                .isEqualTo(MusicSearchException.CODE_FAILED));
    }
}
```

- [ ] **Step 3: Run RED**

Run: `mvn -pl app test -Dtest=YoutubeSearchServiceTest -q`
Expected: 4 FAILURES (class `YoutubeSearchService` doesn't exist).

---

### Task 1.3: YoutubeSearchService — GREEN

**Files:**
- Create: `backend/app/src/main/java/com/drshoes/app/music/YoutubeSearchService.java`

- [ ] **Step 1: Write the implementation**

```java
package com.drshoes.app.music;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
```

- [ ] **Step 2: Run GREEN**

Run: `mvn -pl app test -Dtest=YoutubeSearchServiceTest -q`
Expected: 4 PASSED, 0 FAILED.

- [ ] **Step 3: Commit**

```bash
git add backend/app/src/main/java/com/drshoes/app/music/YoutubeSearchService.java \
        backend/app/src/test/java/com/drshoes/app/music/YoutubeSearchServiceTest.java \
        backend/app/src/test/resources/fixtures/youtube-search-success.json
git commit -m "feat(music): YoutubeSearchService with 4 unit tests

[milestone:music][task:1.2-1.3]
Refs: docs/superpowers/specs/2026-05-18-music-player-design.md"
```

---

### Task 1.4: MusicController — RED + GREEN

**Files:**
- Create: `backend/app/src/test/java/com/drshoes/app/music/MusicControllerTest.java`
- Create: `backend/app/src/main/java/com/drshoes/app/music/MusicController.java`

- [ ] **Step 1: Write the failing tests**

```java
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
```

- [ ] **Step 2: Run RED**

Run: `mvn -pl app test -Dtest=MusicControllerTest -q`
Expected: 5 FAILURES (controller doesn't exist).

> Note: the plan has 5 controller tests not 4 — the spec called for 4 but during plan-writing the LOC-vs-length validation split rationally into 5 (blank + too-long are different paths). Spec amended in spirit, no separate doc update needed.

- [ ] **Step 3: Write MusicController**

```java
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
```

- [ ] **Step 4: Run GREEN**

Run: `mvn -pl app test -Dtest=MusicControllerTest -q`
Expected: 5 PASSED, 0 FAILED.

- [ ] **Step 5: Commit**

```bash
git add backend/app/src/main/java/com/drshoes/app/music/MusicController.java \
        backend/app/src/test/java/com/drshoes/app/music/MusicControllerTest.java
git commit -m "feat(music): MusicController + 5 unit tests

[milestone:music][task:1.4]
Refs: docs/superpowers/specs/2026-05-18-music-player-design.md"
```

---

### Task 1.5: Wire env → Spring config → Docker

**Files:**
- Modify: `backend/app/src/main/resources/application.yaml` (under existing top-level `drshoes:` block)
- Modify: `docker-compose.yml` (under `backend:` service `environment:` block)

- [ ] **Step 1: Append to `application.yaml` under the existing `drshoes:` key**

After the existing `drshoes:` children (`email`, `sms`, `demo`), add:

```yaml
  music:
    youtube-api-key: ${YOUTUBE_API_KEY:}
```

(Indentation: same as `email:`, `sms:`, `demo:`.)

- [ ] **Step 2: Append YOUTUBE_API_KEY to docker-compose `backend.environment`**

Just before the closing of the `environment:` block on the `backend:` service, add a single line:

```yaml
      YOUTUBE_API_KEY: ${YOUTUBE_API_KEY:-}
```

- [ ] **Step 3: Verify maven still builds**

Run: `mvn -pl app -DskipTests package -q`
Expected: BUILD SUCCESS, `target/app-*.jar` exists.

- [ ] **Step 4: Run the full backend suite**

Run: `mvn -pl app test -q`
Expected: all previously-passing tests + 9 new tests (4 service + 5 controller) PASS. Note prior session baseline: numbers above + 9.

- [ ] **Step 5: Commit**

```bash
git add backend/app/src/main/resources/application.yaml docker-compose.yml
git commit -m "feat(music): wire drshoes.music.youtube-api-key from env

[milestone:music][task:1.5]
Refs: docs/superpowers/specs/2026-05-18-music-player-design.md"
```

---

## Phase 2 — Frontend

### Task 2.1: Add react-youtube dependency

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/pnpm-lock.yaml` (auto)

- [ ] **Step 1: Install the dep**

Run from repo root:
```bash
pnpm --filter web add react-youtube@^10
```
Expected: adds `react-youtube` to `dependencies` in `apps/web/package.json` and updates the lockfile.

- [ ] **Step 2: Commit**

```bash
git add apps/web/package.json apps/web/pnpm-lock.yaml
git commit -m "feat(music): add react-youtube dependency

[milestone:music][task:2.1]
Refs: docs/superpowers/specs/2026-05-18-music-player-design.md"
```

---

### Task 2.2: Music fetch wrapper

**Files:**
- Create: `apps/web/lib/music.ts`

- [ ] **Step 1: Write `apps/web/lib/music.ts`**

```ts
import { createLogger } from "@/lib/log";

const log = createLogger("music.client");

export interface Track {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
}

export type MusicError =
  | "invalid_query"
  | "music_search_failed"
  | "music_disabled"
  | "network";

export class MusicSearchError extends Error {
  constructor(public code: MusicError) {
    super(code);
    this.name = "MusicSearchError";
  }
}

export async function searchMusic(q: string, signal?: AbortSignal): Promise<Track[]> {
  const trimmed = q.trim();
  if (trimmed.length === 0) return [];
  try {
    const r = await fetch(
      `/api/admin/music/search?q=${encodeURIComponent(trimmed)}`,
      { signal, credentials: "include" }
    );
    if (!r.ok) {
      const body = (await r.json().catch(() => ({}))) as { error?: MusicError };
      const code = body.error ?? "music_search_failed";
      log.warn("op=music.search.fetch outcome=http_fail status=" + r.status + " code=" + code);
      throw new MusicSearchError(code);
    }
    return (await r.json()) as Track[];
  } catch (e) {
    if (e instanceof MusicSearchError) throw e;
    if ((e as Error)?.name === "AbortError") throw e;
    log.warn("op=music.search.fetch outcome=network msg=" + (e as Error).message);
    throw new MusicSearchError("network");
  }
}
```

- [ ] **Step 2: Type check**

Run: `pnpm --filter web tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/music.ts
git commit -m "feat(music): client-side searchMusic() wrapper

[milestone:music][task:2.2]
Refs: docs/superpowers/specs/2026-05-18-music-player-design.md"
```

---

### Task 2.3: Components — SearchBar, PlayerControls, QueueList

**Files:**
- Create: `apps/web/app/(admin)/admin/muzyka/components/SearchBar.tsx`
- Create: `apps/web/app/(admin)/admin/muzyka/components/PlayerControls.tsx`
- Create: `apps/web/app/(admin)/admin/muzyka/components/QueueList.tsx`

Style note: match the rest of the admin panel — Tailwind utilities with existing tokens (`bg-paper`, `text-ink`, `border-line`, `t-stencil`). Look at `apps/web/app/(admin)/admin/orders/page.tsx` for the lookbook.

- [ ] **Step 1: SearchBar.tsx**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import type { Track } from "@/lib/music";
import { MusicSearchError, searchMusic } from "@/lib/music";
import { createLogger } from "@/lib/log";

const log = createLogger("music.searchbar");

interface Props {
  onPick: (track: Track) => void;
}

const DEBOUNCE_MS = 300;

export function SearchBar({ onPick }: Props) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [errCode, setErrCode] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const trimmed = q.trim();
    if (trimmed.length === 0) {
      setResults([]);
      setErrCode(null);
      return;
    }
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ctl = new AbortController();
      abortRef.current = ctl;
      setLoading(true);
      setErrCode(null);
      try {
        const tracks = await searchMusic(trimmed, ctl.signal);
        setResults(tracks);
      } catch (e) {
        if ((e as Error)?.name === "AbortError") return;
        const code = e instanceof MusicSearchError ? e.code : "music_search_failed";
        log.warn("op=search outcome=fail code=" + code);
        setErrCode(code);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="flex flex-col gap-2">
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Wpisz tytuł utworu albo artystę"
        className="w-full px-3 py-2 border border-line bg-paper text-ink rounded outline-none focus:border-ink"
        aria-label="Szukaj muzyki"
        maxLength={100}
      />
      {errCode && (
        <div role="alert" className="px-3 py-2 border border-red-500 text-red-700 text-sm">
          {errCode === "music_disabled"
            ? "Klucz YouTube nie jest skonfigurowany."
            : "Nie udało się wyszukać. Spróbuj jeszcze raz."}
        </div>
      )}
      {loading && <div className="text-xs opacity-60">Szukam…</div>}
      {results.length > 0 && (
        <ul className="flex flex-col divide-y divide-line border border-line">
          {results.map((t) => (
            <li key={t.videoId}>
              <button
                type="button"
                onClick={() => onPick(t)}
                className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-paper-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.thumbnailUrl} alt="" width={64} height={48} className="flex-none object-cover" />
                <span className="flex flex-col min-w-0">
                  <span className="truncate">{t.title}</span>
                  <span className="text-xs opacity-60 truncate">{t.channelTitle}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: QueueList.tsx**

```tsx
"use client";

import type { Track } from "@/lib/music";

interface Props {
  current: Track | null;
  queue: Track[];
  onSkipTo: (index: number) => void;
  onRemove: (index: number) => void;
}

export function QueueList({ current, queue, onSkipTo, onRemove }: Props) {
  if (!current && queue.length === 0) {
    return <div className="text-xs opacity-60">Brak kolejnych utworów</div>;
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="t-stencil text-[10px] tracking-[.15em] opacity-60">UP NEXT</div>
      {queue.length === 0 ? (
        <div className="text-xs opacity-60">Brak kolejnych utworów</div>
      ) : (
        <ul className="flex flex-col divide-y divide-line border border-line">
          {queue.map((t, i) => (
            <li key={t.videoId + i} className="flex items-center gap-2 px-2 py-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.thumbnailUrl} alt="" width={48} height={36} className="flex-none object-cover" />
              <button
                type="button"
                onClick={() => onSkipTo(i)}
                className="flex flex-col min-w-0 text-left flex-1 hover:opacity-80"
                aria-label={`Przejdź do: ${t.title}`}
              >
                <span className="truncate">{t.title}</span>
                <span className="text-xs opacity-60 truncate">{t.channelTitle}</span>
              </button>
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="text-sm opacity-60 hover:opacity-100 px-2"
                aria-label="Usuń z kolejki"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 3: PlayerControls.tsx**

```tsx
"use client";

interface Props {
  playing: boolean;
  currentTime: number;
  duration: number;
  volume: number; // 0..100
  hasNext: boolean;
  onPlayPause: () => void;
  onSkipBack: () => void;
  onSkipForward: () => void;
  onNext: () => void;
  onSeek: (seconds: number) => void;
  onVolume: (v: number) => void;
}

function fmt(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function PlayerControls({
  playing,
  currentTime,
  duration,
  volume,
  hasNext,
  onPlayPause,
  onSkipBack,
  onSkipForward,
  onNext,
  onSeek,
  onVolume,
}: Props) {
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  return (
    <div className="flex flex-col gap-3 p-3 border border-line bg-paper">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onSkipBack} className="px-2 py-1 hover:bg-paper-2" aria-label="-10s">
          ⏪ 10s
        </button>
        <button
          type="button"
          onClick={onPlayPause}
          className="px-4 py-2 bg-ink text-paper rounded"
          aria-label={playing ? "Pauza" : "Odtwarzaj"}
        >
          {playing ? "⏸" : "▶"}
        </button>
        <button type="button" onClick={onSkipForward} className="px-2 py-1 hover:bg-paper-2" aria-label="+10s">
          10s ⏩
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!hasNext}
          className="px-2 py-1 hover:bg-paper-2 disabled:opacity-30"
          aria-label="Następny"
        >
          ⏭
        </button>
        <div className="ml-auto text-xs opacity-70 tabular-nums">
          {fmt(currentTime)} / {fmt(duration)}
        </div>
      </div>

      <input
        type="range"
        min={0}
        max={duration || 0}
        value={Math.min(currentTime, duration || 0)}
        onChange={(e) => onSeek(Number(e.target.value))}
        className="w-full"
        aria-label="Pasek postępu"
        step={1}
      />

      <div className="flex items-center gap-2">
        <span className="text-xs opacity-60">🔊</span>
        <input
          type="range"
          min={0}
          max={100}
          value={volume}
          onChange={(e) => onVolume(Number(e.target.value))}
          className="flex-1"
          aria-label="Głośność"
        />
        <span className="text-xs opacity-60 w-10 tabular-nums text-right">{volume}%</span>
        <div
          className="hidden md:block flex-1 h-1 bg-paper-2 relative"
          aria-hidden="true"
          title="progress"
        >
          <div className="absolute inset-y-0 left-0 bg-ink" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Type check**

Run: `pnpm --filter web tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(admin\)/admin/muzyka/components/
git commit -m "feat(music): SearchBar, QueueList, PlayerControls components

[milestone:music][task:2.3]
Refs: docs/superpowers/specs/2026-05-18-music-player-design.md"
```

---

### Task 2.4: MusicClient — RED + GREEN

**Files:**
- Create: `apps/web/app/(admin)/admin/muzyka/__tests__/MusicClient.test.tsx`
- Create: `apps/web/app/(admin)/admin/muzyka/MusicClient.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MusicClient } from "../MusicClient";

// Capture the player ref methods + onEnd handler exposed by react-youtube.
const playerStub = {
  playVideo: vi.fn(),
  pauseVideo: vi.fn(),
  seekTo: vi.fn(),
  setVolume: vi.fn(),
  getCurrentTime: vi.fn(() => 0),
  getDuration: vi.fn(() => 0),
};
let capturedOnEnd: (() => void) | null = null;

vi.mock("react-youtube", () => ({
  default: (props: { videoId?: string; onEnd?: () => void; onReady?: (e: { target: typeof playerStub }) => void }) => {
    capturedOnEnd = props.onEnd ?? null;
    // simulate onReady so MusicClient grabs the player ref synchronously
    setTimeout(() => props.onReady?.({ target: playerStub }), 0);
    return <div data-testid="yt-stub">{props.videoId}</div>;
  },
}));

const fetchMock = vi.fn();
beforeEach(() => {
  capturedOnEnd = null;
  Object.values(playerStub).forEach((m) => "mockClear" in m && (m as ReturnType<typeof vi.fn>).mockClear());
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function trackResponse(...ids: string[]) {
  return {
    ok: true,
    json: async () =>
      ids.map((id, i) => ({
        videoId: id,
        title: `Title ${id}`,
        channelTitle: "Chan",
        thumbnailUrl: `https://t/${id}.jpg`,
      })),
  } as Response;
}

describe("MusicClient", () => {
  it("debounces and calls searchMusic once after typing", async () => {
    fetchMock.mockResolvedValue(trackResponse("a"));
    render(<MusicClient />);
    const input = screen.getByLabelText("Szukaj muzyki");
    fireEvent.change(input, { target: { value: "lo" } });
    fireEvent.change(input, { target: { value: "lof" } });
    fireEvent.change(input, { target: { value: "lofi" } });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1), { timeout: 1000 });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/admin/music/search?q=lofi"),
      expect.objectContaining({ credentials: "include" })
    );
  });

  it("clicking the first result with empty player sets it as current", async () => {
    fetchMock.mockResolvedValue(trackResponse("a", "b"));
    render(<MusicClient />);
    fireEvent.change(screen.getByLabelText("Szukaj muzyki"), { target: { value: "x" } });
    const row = await screen.findByRole("button", { name: /Title a/ });
    fireEvent.click(row);
    expect(await screen.findByTestId("yt-stub")).toHaveTextContent("a");
  });

  it("clicking a second result while playing appends to queue, does not replace", async () => {
    fetchMock.mockResolvedValue(trackResponse("a", "b"));
    render(<MusicClient />);
    fireEvent.change(screen.getByLabelText("Szukaj muzyki"), { target: { value: "x" } });
    fireEvent.click(await screen.findByRole("button", { name: /Title a/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Title b/ }));
    expect(screen.getByTestId("yt-stub")).toHaveTextContent("a");
    // queue chip exists
    expect(await screen.findByLabelText("Przejdź do: Title b")).toBeInTheDocument();
  });

  it("onEnd with queue advances; onEnd with empty queue clears", async () => {
    fetchMock.mockResolvedValue(trackResponse("a", "b"));
    render(<MusicClient />);
    fireEvent.change(screen.getByLabelText("Szukaj muzyki"), { target: { value: "x" } });
    fireEvent.click(await screen.findByRole("button", { name: /Title a/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Title b/ }));
    // simulate track A ending
    await waitFor(() => expect(capturedOnEnd).toBeTruthy());
    act(() => capturedOnEnd!());
    expect(screen.getByTestId("yt-stub")).toHaveTextContent("b");
    // simulate B ending (queue empty)
    act(() => capturedOnEnd!());
    expect(screen.queryByTestId("yt-stub")).toBeNull();
  });

  it("backend 503 shows the disabled banner", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: "music_disabled" }),
    } as Response);
    render(<MusicClient />);
    fireEvent.change(screen.getByLabelText("Szukaj muzyki"), { target: { value: "x" } });
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("Klucz YouTube")
    );
  });
});
```

- [ ] **Step 2: Run RED**

Run: `pnpm --filter web test -- MusicClient`
Expected: 5 FAILURES (component doesn't exist).

- [ ] **Step 3: Write MusicClient**

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import YouTube, { type YouTubePlayer, type YouTubeEvent } from "react-youtube";
import type { Track } from "@/lib/music";
import { SearchBar } from "./components/SearchBar";
import { PlayerControls } from "./components/PlayerControls";
import { QueueList } from "./components/QueueList";
import { createLogger } from "@/lib/log";

const log = createLogger("music.client");

export function MusicClient() {
  const [current, setCurrent] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(80);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startPolling = useCallback(() => {
    pollRef.current && clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      const p = playerRef.current;
      if (!p) return;
      try {
        setCurrentTime(p.getCurrentTime?.() ?? 0);
        setDuration(p.getDuration?.() ?? 0);
      } catch {
        // ignore — iframe not ready yet
      }
    }, 500);
  }, []);

  useEffect(() => () => { pollRef.current && clearInterval(pollRef.current); }, []);

  const pick = useCallback((t: Track) => {
    if (!current) {
      setCurrent(t);
    } else {
      setQueue((q) => [...q, t]);
    }
  }, [current]);

  const advance = useCallback(() => {
    setQueue((q) => {
      if (q.length === 0) {
        setCurrent(null);
        return q;
      }
      const [next, ...rest] = q;
      setCurrent(next);
      return rest;
    });
  }, []);

  const onReady = (e: YouTubeEvent) => {
    playerRef.current = e.target;
    try {
      e.target.setVolume(volume);
    } catch {
      // ignore
    }
    startPolling();
  };
  const onStateChange = (e: YouTubeEvent) => {
    // YT.PlayerState: PLAYING=1 PAUSED=2 ENDED=0
    const state = (e.data as number) ?? -1;
    setPlaying(state === 1);
  };
  const onEnd = () => {
    log.info("op=music.track.ended");
    advance();
  };

  const playPause = () => {
    const p = playerRef.current;
    if (!p) return;
    playing ? p.pauseVideo() : p.playVideo();
  };
  const skipBack = () => playerRef.current?.seekTo(Math.max(currentTime - 10, 0), true);
  const skipForward = () => playerRef.current?.seekTo(currentTime + 10, true);
  const seek = (s: number) => playerRef.current?.seekTo(s, true);
  const setVolume = (v: number) => {
    setVolumeState(v);
    playerRef.current?.setVolume(v);
  };

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <SearchBar onPick={pick} />

      {current && (
        <>
          <div className="flex items-start gap-4">
            <div className="flex-none w-[320px]">
              <YouTube
                videoId={current.videoId}
                opts={{
                  width: "320",
                  height: "180",
                  playerVars: { autoplay: 1, modestbranding: 1, rel: 0 },
                }}
                onReady={onReady}
                onStateChange={onStateChange}
                onEnd={onEnd}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="t-stencil text-[10px] tracking-[.15em] opacity-60">NOW PLAYING</div>
              <div className="text-lg truncate">{current.title}</div>
              <div className="text-sm opacity-70 truncate">{current.channelTitle}</div>
            </div>
          </div>

          <PlayerControls
            playing={playing}
            currentTime={currentTime}
            duration={duration}
            volume={volume}
            hasNext={queue.length > 0}
            onPlayPause={playPause}
            onSkipBack={skipBack}
            onSkipForward={skipForward}
            onNext={advance}
            onSeek={seek}
            onVolume={setVolume}
          />
        </>
      )}

      <QueueList
        current={current}
        queue={queue}
        onSkipTo={(i) => {
          setQueue((q) => {
            const next = q[i];
            const before = q.slice(0, i);
            const after = q.slice(i + 1);
            // current track goes back to head of queue? No — we drop it (simplest).
            setCurrent(next);
            return [...before, ...after];
          });
        }}
        onRemove={(i) => setQueue((q) => q.filter((_, idx) => idx !== i))}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run GREEN**

Run: `pnpm --filter web test -- MusicClient`
Expected: 5 PASSED, 0 FAILED.

- [ ] **Step 5: Run the full frontend suite (regression check)**

Run: `pnpm --filter web test`
Expected: prior baseline + 5 new tests, all GREEN.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/\(admin\)/admin/muzyka/MusicClient.tsx \
        apps/web/app/\(admin\)/admin/muzyka/__tests__/MusicClient.test.tsx
git commit -m "feat(music): MusicClient brain + 5 vitest cases

[milestone:music][task:2.4]
Refs: docs/superpowers/specs/2026-05-18-music-player-design.md"
```

---

### Task 2.5: Page shell + sidebar entry

**Files:**
- Create: `apps/web/app/(admin)/admin/muzyka/page.tsx`
- Modify: `apps/web/components/admin/AdminSidebarNav.tsx`

- [ ] **Step 1: Write `page.tsx`**

```tsx
import { MusicClient } from "./MusicClient";

export const metadata = {
  title: "Muzyka",
};

export default function MuzykaPage() {
  return (
    <div className="p-6 flex flex-col gap-4">
      <h1 className="t-stencil text-2xl tracking-wider">MUZYKA</h1>
      <p className="text-sm opacity-70">
        Wpisz tytuł utworu albo artystę. Wybrany utwór odtwarza się tutaj —
        po opuszczeniu strony muzyka się zatrzymuje.
      </p>
      <MusicClient />
    </div>
  );
}
```

- [ ] **Step 2: Add the sidebar entry**

In `apps/web/components/admin/AdminSidebarNav.tsx`, between the existing `SKLEP` block and `KONFIGURACJA` block, insert:

```tsx
      <SectionLabel>PRZERWA</SectionLabel>
      <NavLink href="/admin/muzyka" label="Muzyka" />
```

- [ ] **Step 3: Type check**

Run: `pnpm --filter web tsc --noEmit`
Expected: no errors. Note: if `next typed-routes` complains about `/admin/muzyka`, wrap with `as Route` in the `NavLink` `href` prop the same way the rest of the file already does (it doesn't currently — but if it errors, add `import type { Route } from "next"` import already exists, just cast).

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(admin\)/admin/muzyka/page.tsx \
        apps/web/components/admin/AdminSidebarNav.tsx
git commit -m "feat(music): page shell + sidebar PRZERWA section

[milestone:music][task:2.5]
Refs: docs/superpowers/specs/2026-05-18-music-player-design.md"
```

---

## Phase 3 — Verification

### Task 3.1: Build the backend jar (mandatory — backend container does NOT recompile Java)

- [ ] **Step 1: Maven package**

Run: `mvn -pl app -am -DskipTests clean package -q`
Expected: BUILD SUCCESS. `backend/app/target/app-*.jar` is fresh.

### Task 3.2: Rebuild + restart containers

- [ ] **Step 1: Confirm `.env` has `YOUTUBE_API_KEY=AIzaSyCKGgZvtIafraJlLER1QJG_MG_m4EaPVdc`** (already added by owner during planning).

- [ ] **Step 2: Rebuild + bounce backend + web**

```bash
docker compose build backend web
docker compose up -d backend web
```

Expected: both services become healthy within ~30 s.

- [ ] **Step 3: Tail backend logs for the env binding**

```bash
docker compose logs backend --tail=80 | grep -iE 'started|music|youtube' || true
```

Expected: "Started DrShoesApplication", no errors about `drshoes.music.youtube-api-key`.

### Task 3.3: Smoke-verify the API

- [ ] **Step 1: Get a session cookie**

Use the existing quicklogin endpoint or manual login UI. Save the `dr_session` cookie value into env `COOKIE`.

- [ ] **Step 2: Curl the search endpoint**

```bash
curl -s -o /tmp/music.json -w "HTTP %{http_code}\n" \
  "http://localhost:8080/api/admin/music/search?q=lofi" \
  -H "Cookie: dr_session=$COOKIE"
head -c 400 /tmp/music.json
```

Expected: `HTTP 200` and a JSON array with at least one `videoId`.

- [ ] **Step 3: Negative path**

```bash
curl -s -o /dev/null -w "HTTP %{http_code}\n" \
  "http://localhost:8080/api/admin/music/search?q=" \
  -H "Cookie: dr_session=$COOKIE"
```

Expected: `HTTP 400`.

### Task 3.4: Playwright smoke

- [ ] **Step 1: Drive the UI**

Use `mcp__playwright__browser_navigate` + `browser_type` + `browser_snapshot`:

1. Navigate to `http://localhost:3000/admin/muzyka` (login via quicklogin if needed).
2. Type `lofi` into the search input.
3. Wait for ≥ 1 result row.
4. Click the first row.
5. Snapshot — assert iframe with `youtube.com/embed/` is present.

Expected: snapshot shows the iframe, no console errors.

### Task 3.5: Write the dispatch log

- [ ] **Step 1: Create** `docs/dispatch-log/music-player-<UTC>.md`

Include files touched, commands run, test counts, the smoke curl/Playwright result, the head commit SHA, and tag any deviations from the plan.

- [ ] **Step 2: Final commit (only if there are unstaged changes such as the dispatch log)**

```bash
git add docs/dispatch-log/music-player-*.md
git commit -m "docs(dispatch): music player implementation log

[milestone:music][task:3.5]
Refs: docs/superpowers/specs/2026-05-18-music-player-design.md"
```

---

## Plan self-review

Spec coverage:
- Route `/admin/muzyka` → Task 2.5 page shell ✓
- Search box → Task 2.3 SearchBar ✓
- Auto-advancing queue → Task 2.4 MusicClient `advance()` + onEnd ✓
- Custom controls → Task 2.3 PlayerControls ✓
- Sidebar entry under new PRZERWA → Task 2.5 ✓
- `MusicController` + `YoutubeSearchService` + DTO + exception → Tasks 1.1-1.4 ✓
- 8 backend tests → Tasks 1.2 (4) + 1.4 (5) = 9 (one above spec; documented in errata) ✓
- 5 frontend tests → Task 2.4 ✓
- `YOUTUBE_API_KEY` env → Task 1.5 ✓
- Spring config — `drshoes.music.youtube-api-key` per errata #1 ✓
- 502 / 503 / 400 contracts → Task 1.4 tests + impl ✓
- No DB, no migration, no audit row → architecture pinned, no task touches V*.sql ✓

Placeholder scan: clean. All code shown, no "TODO".

Type consistency: `Track` type defined in `lib/music.ts` reused in every frontend file. `MusicTrackDto` shape mirrors `Track`. `MusicSearchException.code()` reused everywhere. `playerRef` typed as `YouTubePlayer` from react-youtube.

Owner action item from spec (key in `.env`, GCP API enablement): already done during planning.
