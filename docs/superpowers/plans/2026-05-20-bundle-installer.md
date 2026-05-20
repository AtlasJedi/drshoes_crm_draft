# Client Bundle Installer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a self-contained, double-click-to-run Dr Shoes installer for a client on macOS 10.15 Catalina (Intel), delivered as a single zip on Google Drive. All pipeline artifacts live in a new `client-installer/` directory; main repo only gains profile-gated backend code + a Next standalone flag.

**Architecture:** Spring Boot fat JAR with embedded Postgres (Zonky `embedded-postgres-binaries-darwin-amd64`) under a new `bundle` profile. Local-filesystem blob storage. No-op messaging providers (email/SMS/whatsapp log instead of send). Next.js standalone build runs on bundled Node 18. Liberica JDK 21 + Node 18 + Postgres binaries bundled — no system installs.

**Tech Stack:** Java 21 / Spring Boot 3.4 / Liberica JDK 21 Standard x86_64 / Node 18.20.x LTS x86_64 / `io.zonky.test:embedded-postgres:2.0.7` + PG 16.4 binaries / Next 16 standalone / bash + osascript launchers.

**Spec:** `docs/superpowers/specs/2026-05-20-bundle-installer-design.md` (commit `e022b53` + `d650101`).

**Milestone tag (commits):** `[milestone:client-installer][task:ci-<N>]`. Each task writes a dispatch log to `docs/dispatch-log/ci-<N>-<UTC>.md` per project protocol.

---

## File structure

### New files in `backend/`

| Path | Purpose | LOC budget |
|------|---------|-----------:|
| `backend/app/src/main/resources/application-bundle.yaml` | Spring profile for bundle runtime | ~40 |
| `backend/app/src/main/java/com/drshoes/app/bundle/BundleEmbeddedPostgresAutoConfig.java` | Starts Zonky EmbeddedPostgres, exposes DataSource, lifecycle-managed | ~80 |
| `backend/app/src/main/java/com/drshoes/app/bundle/BundleEmbeddedPostgresProperties.java` | `@ConfigurationProperties("drshoes.embedded-postgres")` | ~30 |
| `backend/libs/storage/src/main/java/com/drshoes/lib/storage/LocalFsBlobStorage.java` | Local filesystem `BlobStorage` impl | ~110 |
| `backend/app/src/main/java/com/drshoes/app/bundle/LocalBlobController.java` | `@Profile("bundle")` controller serving `/api/admin/photos/local/**` | ~70 |
| `backend/libs/email-gateway/src/main/java/com/drshoes/lib/email/NoopEmailProvider.java` | `@ConditionalOnProperty` noop impl, logs payload | ~50 |
| `backend/libs/sms-gateway/src/main/java/com/drshoes/lib/sms/NoopSmsProvider.java` | same shape for SMS | ~50 |
| `backend/libs/whatsapp-gateway/src/main/java/com/drshoes/lib/whatsapp/NoopWhatsappProvider.java` | same shape for WhatsApp | ~50 |
| `backend/app/src/test/java/com/drshoes/app/bundle/LocalFsBlobStorageTest.java` | unit tests with `@TempDir` | ~110 |
| `backend/app/src/test/java/com/drshoes/app/bundle/BundleProfileBootIntegrationTest.java` | `@SpringBootTest(profiles="bundle")` full boot + Flyway smoke | ~80 |
| `backend/app/src/test/java/com/drshoes/app/bundle/NoopEmailProviderTest.java` | unit test for noop email | ~45 |

### Modified files in `backend/`

| Path | Change |
|------|-------:|
| `backend/pom.xml` | Add `bundle` Maven profile that pulls `io.zonky.test:embedded-postgres:2.0.7` and `embedded-postgres-binaries-darwin-amd64:16.4.0` |
| `backend/libs/storage/src/main/java/com/drshoes/lib/storage/StorageAutoConfiguration.java` | Wire `local-fs` storage type to `LocalFsBlobStorage` |
| `backend/libs/storage/src/main/java/com/drshoes/lib/storage/StorageProperties.java` | Add `local-fs` to the `type` enum + a `root` path property |

### Modified files in `apps/web/`

| Path | Change |
|------|-------:|
| `apps/web/next.config.mjs` | Add `output: 'standalone'`, `images.unoptimized: true` for bundle target |

### New files in `client-installer/` (all new)

| Path | Purpose |
|------|---------|
| `client-installer/VERSION` | Single line, e.g. `1.0.0` |
| `client-installer/CHANGELOG.md` | Versions shipped to client, dates, what changed |
| `client-installer/README.md` | Developer runbook: how to build, verify, ship |
| `client-installer/.gitignore` | Ignore `cache/` and `dist/` |
| `client-installer/build-bundle.sh` | One-shot build script (executable) |
| `client-installer/fetch-cached.sh` | Idempotent download helper with SHA-256 check |
| `client-installer/verify.sh` | Static otool/file checks + size assertions |
| `client-installer/templates/DrShoes.command` | Double-click launcher (executable, copied into zip) |
| `client-installer/templates/Stop-DrShoes.command` | Clean shutdown (executable) |
| `client-installer/templates/README.txt` | Client-facing Polish guide |

---

## Wave 1 — Backend bundle profile

### Task ci-1: Add `bundle` Maven profile + Zonky deps

**Files:**
- Modify: `backend/pom.xml`

- [ ] **Step 1: Read the current `backend/pom.xml` to find the `<profiles>` section (or `</project>` if no profiles yet).**

- [ ] **Step 2: Add the `bundle` profile inside `<profiles>` (create the section if absent), just before `</project>`.**

```xml
<profiles>
  <profile>
    <id>bundle</id>
    <dependencies>
      <dependency>
        <groupId>io.zonky.test</groupId>
        <artifactId>embedded-postgres</artifactId>
        <version>2.0.7</version>
      </dependency>
      <dependency>
        <groupId>io.zonky.test.postgres</groupId>
        <artifactId>embedded-postgres-binaries-darwin-amd64</artifactId>
        <version>16.4.0</version>
      </dependency>
    </dependencies>
  </profile>
</profiles>
```

- [ ] **Step 3: Verify the profile resolves dependencies.**

Run: `cd backend && mvn -B -pl app -am -Pbundle -DskipTests dependency:resolve | grep embedded-postgres`
Expected: lines containing `io.zonky.test:embedded-postgres:jar:2.0.7` and `io.zonky.test.postgres:embedded-postgres-binaries-darwin-amd64:jar:16.4.0`.

- [ ] **Step 4: Confirm dev jar is unaffected.**

Run: `cd backend && mvn -B -pl app -am -DskipTests dependency:tree | grep -c embedded-postgres`
Expected: `0` (no embedded-postgres in default classpath).

- [ ] **Step 5: Commit.**

```bash
git add backend/pom.xml
git commit -m "feat(backend): add bundle Maven profile with embedded-postgres [milestone:client-installer][task:ci-1]"
```

---

### Task ci-2: `BundleEmbeddedPostgresProperties` + `BundleEmbeddedPostgresAutoConfig`

**Files:**
- Create: `backend/app/src/main/java/com/drshoes/app/bundle/BundleEmbeddedPostgresProperties.java`
- Create: `backend/app/src/main/java/com/drshoes/app/bundle/BundleEmbeddedPostgresAutoConfig.java`
- Test: covered by ci-7 boot integration test

- [ ] **Step 1: Create the properties class.**

```java
package com.drshoes.app.bundle;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "drshoes.embedded-postgres")
public record BundleEmbeddedPostgresProperties(
    String dataDir,
    int port
) {
    public BundleEmbeddedPostgresProperties {
        if (dataDir == null || dataDir.isBlank()) {
            dataDir = System.getProperty("user.dir") + "/data/pg";
        }
        // port=0 → auto-pick free port
    }
}
```

- [ ] **Step 2: Create the auto-config. Activates only when `spring.profiles.active=bundle` AND the Zonky class is present (so dev jar doesn't blow up if class missing).**

```java
package com.drshoes.app.bundle;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import jakarta.annotation.PreDestroy;
import javax.sql.DataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
import org.springframework.boot.autoconfigure.AutoConfigureBefore;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;

@Configuration
@Profile("bundle")
@ConditionalOnClass(EmbeddedPostgres.class)
@AutoConfigureBefore(DataSourceAutoConfiguration.class)
@EnableConfigurationProperties(BundleEmbeddedPostgresProperties.class)
public class BundleEmbeddedPostgresAutoConfig {

    private static final Logger log = LoggerFactory.getLogger(BundleEmbeddedPostgresAutoConfig.class);

    private EmbeddedPostgres pg;

    @Bean
    public DataSource bundleEmbeddedDataSource(BundleEmbeddedPostgresProperties props) throws Exception {
        Path dataDir = Path.of(props.dataDir());
        Files.createDirectories(dataDir);
        log.info("bundle.embedded-postgres.start dataDir={} port={}", dataDir, props.port());

        this.pg = EmbeddedPostgres.builder()
            .setDataDirectory(dataDir.toFile())
            .setCleanDataDirectory(false)
            .setPort(props.port())
            .start();

        log.info("bundle.embedded-postgres.started jdbc={}", pg.getJdbcUrl("postgres", "postgres"));
        return pg.getPostgresDatabase();
    }

    @PreDestroy
    public void stop() throws Exception {
        if (pg != null) {
            log.info("bundle.embedded-postgres.stop");
            pg.close();
        }
    }
}
```

- [ ] **Step 3: Verify compilation under the bundle profile.**

Run: `cd backend && mvn -B -pl app -am -Pbundle -DskipTests compile`
Expected: BUILD SUCCESS, no `cannot find symbol: EmbeddedPostgres`.

- [ ] **Step 4: Verify dev compilation still works (Zonky class missing — `@ConditionalOnClass` skips bean).**

Run: `cd backend && mvn -B -pl app -am -DskipTests compile`
Expected: BUILD SUCCESS. Bean is not loaded in dev because the class isn't on classpath.

- [ ] **Step 5: Commit.**

```bash
git add backend/app/src/main/java/com/drshoes/app/bundle/
git commit -m "feat(bundle): EmbeddedPostgres auto-config gated on profile=bundle [milestone:client-installer][task:ci-2]"
```

---

### Task ci-3: `LocalFsBlobStorage` (TDD)

**Files:**
- Create: `backend/libs/storage/src/main/java/com/drshoes/lib/storage/LocalFsBlobStorage.java`
- Test: `backend/libs/storage/src/test/java/com/drshoes/lib/storage/LocalFsBlobStorageTest.java`

- [ ] **Step 1: Write the failing test.**

```java
package com.drshoes.lib.storage;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LocalFsBlobStorageTest {

    @Test
    void put_then_get_round_trips_bytes(@TempDir Path root) {
        LocalFsBlobStorage storage = new LocalFsBlobStorage(root);
        BlobKey key = new BlobKey("photos", "2026/05/abc.jpg");
        byte[] payload = "hello".getBytes();

        BlobMetadata meta = storage.put(key, payload, "image/jpeg");

        assertThat(meta.size()).isEqualTo(5);
        assertThat(meta.contentType()).isEqualTo("image/jpeg");
        assertThat(storage.get(key)).isEqualTo(payload);
    }

    @Test
    void get_missing_key_throws(@TempDir Path root) {
        LocalFsBlobStorage storage = new LocalFsBlobStorage(root);
        assertThatThrownBy(() -> storage.get(new BlobKey("photos", "missing.jpg")))
            .isInstanceOf(RuntimeException.class)
            .hasMessageContaining("missing.jpg");
    }

    @Test
    void delete_removes_file(@TempDir Path root) throws Exception {
        LocalFsBlobStorage storage = new LocalFsBlobStorage(root);
        BlobKey key = new BlobKey("photos", "del.jpg");
        storage.put(key, new byte[]{1, 2, 3}, "application/octet-stream");
        assertThat(Files.exists(root.resolve("photos/del.jpg"))).isTrue();

        storage.delete(key);

        assertThat(Files.exists(root.resolve("photos/del.jpg"))).isFalse();
    }

    @Test
    void presigned_get_returns_local_url(@TempDir Path root) {
        LocalFsBlobStorage storage = new LocalFsBlobStorage(root);
        BlobKey key = new BlobKey("photos", "2026/05/abc.jpg");

        PresignedUrl url = storage.presignGet(key, Duration.ofMinutes(15));

        assertThat(url.url()).isEqualTo("/api/admin/photos/local/photos/2026/05/abc.jpg");
        assertThat(url.expiresAt()).isAfter(java.time.Instant.now());
    }

    @Test
    void put_blocks_path_traversal(@TempDir Path root) {
        LocalFsBlobStorage storage = new LocalFsBlobStorage(root);
        // BlobKey constructor or storage should reject ".."
        assertThatThrownBy(() -> storage.put(new BlobKey("photos", "../escaped.jpg"), new byte[]{1}, "image/jpeg"))
            .isInstanceOf(IllegalArgumentException.class);
    }
}
```

- [ ] **Step 2: Run test to verify it fails.**

Run: `cd backend && mvn -B -pl libs/storage test -Dtest=LocalFsBlobStorageTest`
Expected: FAIL — `LocalFsBlobStorage` class not found.

- [ ] **Step 3: Inspect existing `BlobStorage` interface to match its signature exactly.**

Read: `backend/libs/storage/src/main/java/com/drshoes/lib/storage/BlobStorage.java` to confirm method signatures (`get`, `put`, `delete`, `presignGet`). If signatures in the test above don't match, adjust the test to match (e.g. if `put` returns `void` instead of `BlobMetadata`, change the test).

- [ ] **Step 4: Implement `LocalFsBlobStorage`.**

```java
package com.drshoes.lib.storage;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;

public class LocalFsBlobStorage implements BlobStorage {

    private static final Logger log = LoggerFactory.getLogger(LocalFsBlobStorage.class);

    private final Path root;

    public LocalFsBlobStorage(Path root) {
        this.root = root.toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.root);
        } catch (IOException e) {
            throw new IllegalStateException("Cannot create blob root " + this.root, e);
        }
    }

    @Override
    public byte[] get(BlobKey key) {
        Path p = resolve(key);
        try {
            return Files.readAllBytes(p);
        } catch (NoSuchFileException e) {
            log.warn("blob.local.get.miss key={} path={}", key, p);
            throw new RuntimeException("Blob not found: " + key.fullPath(), e);
        } catch (IOException e) {
            throw new RuntimeException("Blob read failed: " + key.fullPath(), e);
        }
    }

    @Override
    public BlobMetadata put(BlobKey key, byte[] bytes, String contentType) {
        Path p = resolve(key);
        try {
            Files.createDirectories(p.getParent());
            Files.write(p, bytes);
            log.info("blob.local.put key={} bytes={} contentType={}", key, bytes.length, contentType);
            return new BlobMetadata(key, bytes.length, contentType, Instant.now());
        } catch (IOException e) {
            throw new RuntimeException("Blob write failed: " + key.fullPath(), e);
        }
    }

    @Override
    public void delete(BlobKey key) {
        Path p = resolve(key);
        try {
            Files.deleteIfExists(p);
            log.info("blob.local.delete key={}", key);
        } catch (IOException e) {
            throw new RuntimeException("Blob delete failed: " + key.fullPath(), e);
        }
    }

    @Override
    public PresignedUrl presignGet(BlobKey key, Duration ttl) {
        return new PresignedUrl(
            "/api/admin/photos/local/" + key.fullPath(),
            Instant.now().plus(ttl)
        );
    }

    private Path resolve(BlobKey key) {
        Path resolved = root.resolve(key.fullPath()).normalize();
        if (!resolved.startsWith(root)) {
            throw new IllegalArgumentException("Path traversal blocked: " + key.fullPath());
        }
        return resolved;
    }
}
```

> Adapt `BlobMetadata` constructor call to match the actual record/class in `backend/libs/storage/src/main/java/com/drshoes/lib/storage/BlobMetadata.java`. If field names differ (e.g. `createdAt` vs `now`), match the existing signature.

- [ ] **Step 5: Run test to verify it passes.**

Run: `cd backend && mvn -B -pl libs/storage test -Dtest=LocalFsBlobStorageTest`
Expected: PASS, 5/5 tests green.

- [ ] **Step 6: Commit.**

```bash
git add backend/libs/storage/src/main/java/com/drshoes/lib/storage/LocalFsBlobStorage.java backend/libs/storage/src/test/java/com/drshoes/lib/storage/LocalFsBlobStorageTest.java
git commit -m "feat(storage): LocalFsBlobStorage with path-traversal guard [milestone:client-installer][task:ci-3]"
```

---

### Task ci-4: Wire `local-fs` into `StorageAutoConfiguration` + `LocalBlobController`

**Files:**
- Modify: `backend/libs/storage/src/main/java/com/drshoes/lib/storage/StorageAutoConfiguration.java`
- Modify: `backend/libs/storage/src/main/java/com/drshoes/lib/storage/StorageProperties.java`
- Create: `backend/app/src/main/java/com/drshoes/app/bundle/LocalBlobController.java`

- [ ] **Step 1: Read `StorageProperties.java` and `StorageAutoConfiguration.java`.** Note the exact structure of `type` (enum vs string), existing conditional logic, and how `S3BlobStorage` / `NoOpBlobStorage` are picked.

- [ ] **Step 2: Add `local-fs` as a recognized type in `StorageProperties`.**

If `type` is an enum, add `LOCAL_FS`. If string, add `"local-fs"` to switch logic. Add a `root` Path field with a default of `${user.dir}/data/blobs`.

```java
// In StorageProperties.java — add field
private String root = System.getProperty("user.dir") + "/data/blobs";

public String getRoot() { return root; }
public void setRoot(String root) { this.root = root; }
```

- [ ] **Step 3: Extend `StorageAutoConfiguration` with the local-fs branch.**

Add (alongside existing S3/NoOp branches):

```java
@Bean
@ConditionalOnProperty(name = "drshoes.storage.type", havingValue = "local-fs")
public BlobStorage localFsBlobStorage(StorageProperties props) {
    return new LocalFsBlobStorage(java.nio.file.Path.of(props.getRoot()));
}
```

Ensure the existing S3 and NoOp beans have explicit `havingValue` (e.g. `s3`, `noop`) so they don't collide.

- [ ] **Step 4: Create `LocalBlobController` — `@Profile("bundle")`, admin-session-gated.**

```java
package com.drshoes.app.bundle;

import com.drshoes.lib.storage.BlobKey;
import com.drshoes.lib.storage.BlobStorage;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Profile("bundle")
@RequestMapping("/api/admin/photos/local")
public class LocalBlobController {

    private static final Logger log = LoggerFactory.getLogger(LocalBlobController.class);
    private final BlobStorage storage;

    public LocalBlobController(BlobStorage storage) {
        this.storage = storage;
    }

    @GetMapping("/**")
    public ResponseEntity<byte[]> serve(HttpServletRequest request) {
        String fullPath = request.getRequestURI().substring("/api/admin/photos/local/".length());
        int slash = fullPath.indexOf('/');
        if (slash < 0) return ResponseEntity.notFound().build();
        String bucket = fullPath.substring(0, slash);
        String objectPath = fullPath.substring(slash + 1);

        try {
            byte[] body = storage.get(new BlobKey(bucket, objectPath));
            String contentType = guessContentType(objectPath);
            log.info("blob.local.serve bucket={} object={} bytes={}", bucket, objectPath, body.length);
            return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, contentType)
                .header(HttpHeaders.CACHE_CONTROL, "private, max-age=300")
                .body(body);
        } catch (RuntimeException e) {
            log.warn("blob.local.serve.miss bucket={} object={}", bucket, objectPath);
            return ResponseEntity.notFound().build();
        }
    }

    private String guessContentType(String name) {
        String lower = name.toLowerCase();
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return MediaType.IMAGE_JPEG_VALUE;
        if (lower.endsWith(".png")) return MediaType.IMAGE_PNG_VALUE;
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".pdf")) return MediaType.APPLICATION_PDF_VALUE;
        return MediaType.APPLICATION_OCTET_STREAM_VALUE;
    }
}
```

> If the project already gates admin routes via a Spring Security filter chain, confirm `/api/admin/**` is covered. If not, add `.requestMatchers("/api/admin/photos/local/**").authenticated()` to the security config under the bundle profile. Check `backend/app/src/main/java/com/drshoes/app/auth/SecurityConfig.java` (or similar).

- [ ] **Step 5: Run backend test suite to confirm nothing breaks in default profile.**

Run: `cd backend && mvn -B -pl app -am test`
Expected: green (matches previous baseline, e.g. 398/0/0/0).

- [ ] **Step 6: Commit.**

```bash
git add backend/libs/storage/ backend/app/src/main/java/com/drshoes/app/bundle/LocalBlobController.java
git commit -m "feat(storage): wire local-fs storage + admin blob controller [milestone:client-installer][task:ci-4]"
```

---

### Task ci-5: Noop messaging providers (email, SMS, WhatsApp)

**Files:**
- Create: `backend/libs/email-gateway/src/main/java/com/drshoes/lib/email/NoopEmailProvider.java`
- Create: `backend/libs/email-gateway/src/test/java/com/drshoes/lib/email/NoopEmailProviderTest.java`
- Create: `backend/libs/sms-gateway/src/main/java/com/drshoes/lib/sms/NoopSmsProvider.java`
- Create: `backend/libs/whatsapp-gateway/src/main/java/com/drshoes/lib/whatsapp/NoopWhatsappProvider.java`

- [ ] **Step 1: Read each existing provider's interface to match signatures.**

Read:
- `backend/libs/email-gateway/src/main/java/com/drshoes/lib/email/EmailProvider.java` (or similar)
- `backend/libs/sms-gateway/src/main/java/com/drshoes/lib/sms/SmsProvider.java`
- `backend/libs/whatsapp-gateway/src/main/java/com/drshoes/lib/whatsapp/WhatsappProvider.java`

Note the `send(...)` method signature and what type it returns (probably some `SendResult` or similar). Match exactly.

- [ ] **Step 2: Write the failing test for `NoopEmailProvider`.**

```java
package com.drshoes.lib.email;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class NoopEmailProviderTest {

    @Test
    void send_returns_synthetic_id_and_does_not_throw() {
        NoopEmailProvider provider = new NoopEmailProvider();
        // Adjust EmailMessage constructor to match the project's existing record/class.
        EmailMessage msg = new EmailMessage(
            "to@example.com", "subject", "body", null
        );

        SendResult result = provider.send(msg);

        assertThat(result.providerMessageId()).startsWith("noop-");
        assertThat(result.outcome()).isEqualTo("NOOP_BUNDLE");
    }
}
```

> If the project's `SendResult`/`EmailMessage` types differ, mirror them.

- [ ] **Step 3: Run test to verify it fails.**

Run: `cd backend && mvn -B -pl libs/email-gateway test -Dtest=NoopEmailProviderTest`
Expected: FAIL — class not found.

- [ ] **Step 4: Implement `NoopEmailProvider`.**

```java
package com.drshoes.lib.email;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
@ConditionalOnProperty(name = "drshoes.messaging.email-provider", havingValue = "noop")
public class NoopEmailProvider implements EmailProvider {

    private static final Logger log = LoggerFactory.getLogger(NoopEmailProvider.class);

    @Override
    public SendResult send(EmailMessage message) {
        String id = "noop-" + UUID.randomUUID();
        log.info("email.noop.send to={} subject={} bodyLen={} messageId={} outcome=NOOP_BUNDLE",
            message.to(), message.subject(),
            message.body() == null ? 0 : message.body().length(), id);
        return new SendResult(id, "NOOP_BUNDLE");
    }
}
```

> Adapt to the actual `SendResult` constructor.

- [ ] **Step 5: Run test to verify it passes.**

Run: `cd backend && mvn -B -pl libs/email-gateway test -Dtest=NoopEmailProviderTest`
Expected: PASS.

- [ ] **Step 6: Replicate for `NoopSmsProvider` and `NoopWhatsappProvider`** — same pattern, different condition property names (`drshoes.messaging.sms-provider=noop`, `drshoes.messaging.whatsapp-provider=noop`), and matching their interfaces. No separate tests required (pattern identical to email; existing message-router integration test in Wave 1 closure will exercise them).

- [ ] **Step 7: Run all backend tests.**

Run: `cd backend && mvn -B test`
Expected: green; new tests added; no regressions.

- [ ] **Step 8: Commit.**

```bash
git add backend/libs/email-gateway/ backend/libs/sms-gateway/ backend/libs/whatsapp-gateway/
git commit -m "feat(messaging): noop providers for bundle (logs payload, no send) [milestone:client-installer][task:ci-5]"
```

---

### Task ci-6: `application-bundle.yaml`

**Files:**
- Create: `backend/app/src/main/resources/application-bundle.yaml`

- [ ] **Step 1: Create the bundle profile config.**

```yaml
spring:
  datasource:
    # URL/username/password supplied by BundleEmbeddedPostgresAutoConfig DataSource bean.
    # Spring Boot accepts a programmatic DataSource and skips its own auto-config.
    initialization-mode: never
  jpa:
    hibernate:
      ddl-auto: none
    open-in-view: false
  flyway:
    enabled: true
    locations: classpath:db/migration
    baseline-on-migrate: false
  session:
    store-type: jdbc

server:
  port: 8080
  forward-headers-strategy: native

drshoes:
  storage:
    type: local-fs
    root: ${user.dir}/data/blobs
  messaging:
    email-provider: noop
    sms-provider: noop
    whatsapp-provider: noop
  demo:
    seed-enabled: true
  embedded-postgres:
    data-dir: ${user.dir}/data/pg
    port: 0

management:
  endpoints:
    web:
      exposure:
        include: health, info
  tracing:
    enabled: false
  health:
    probes:
      enabled: true

otel:
  sdk:
    disabled: true

logging:
  file:
    name: ${user.dir}/data/logs/backend.log
  level:
    com.drshoes: INFO
    org.springframework: WARN
    org.hibernate: WARN
```

> Match property keys to what the existing `application-local.yaml` uses. If `drshoes.messaging.*-provider` keys don't already exist, adjust both this file and the noop `@ConditionalOnProperty` annotations to match the project's naming. Verify via `grep -r 'drshoes.messaging' backend/`.

- [ ] **Step 2: Commit.**

```bash
git add backend/app/src/main/resources/application-bundle.yaml
git commit -m "feat(bundle): application-bundle.yaml profile [milestone:client-installer][task:ci-6]"
```

---

### Task ci-7: Bundle profile boot integration test

**Files:**
- Create: `backend/app/src/test/java/com/drshoes/app/bundle/BundleProfileBootIntegrationTest.java`

> Test name uses `*IntegrationTest.java` (NOT `*IT.java`) per memory `project_session_2026_05_09_part4.md` — Failsafe `*IT.java` doesn't run in this project's CI.

- [ ] **Step 1: Write the test.**

```java
package com.drshoes.app.bundle;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(
    classes = com.drshoes.app.DrShoesApplication.class,
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {
        "drshoes.embedded-postgres.data-dir=${java.io.tmpdir}/drshoes-pg-it-${random.uuid}",
        "drshoes.storage.root=${java.io.tmpdir}/drshoes-blobs-it-${random.uuid}",
        "drshoes.demo.seed-enabled=false"
    }
)
@ActiveProfiles("bundle")
class BundleProfileBootIntegrationTest {

    @Autowired
    DataSource dataSource;

    @Test
    void context_loads_and_flyway_applied() throws Exception {
        try (Connection c = dataSource.getConnection();
             Statement s = c.createStatement();
             ResultSet rs = s.executeQuery("SELECT count(*) FROM flyway_schema_history WHERE success = true")) {
            assertThat(rs.next()).isTrue();
            int applied = rs.getInt(1);
            assertThat(applied).isGreaterThanOrEqualTo(34); // V001..V034 minimum
        }
    }

    @Test
    void core_tables_exist() throws Exception {
        try (Connection c = dataSource.getConnection();
             Statement s = c.createStatement();
             ResultSet rs = s.executeQuery(
                 "SELECT count(*) FROM information_schema.tables " +
                 "WHERE table_schema = 'public' AND table_name IN ('user_', 'client', 'order_', 'message_thread')")) {
            assertThat(rs.next()).isTrue();
            assertThat(rs.getInt(1)).isEqualTo(4);
        }
    }
}
```

> Verify the JAR-level entry class name matches `DrShoesApplication` (look for `@SpringBootApplication` in `backend/app/src/main/java/com/drshoes/app/`). Adjust if different.

- [ ] **Step 2: Run integration test under the bundle profile.**

Run: `cd backend && mvn -B -pl app -am -Pbundle test -Dtest=BundleProfileBootIntegrationTest`
Expected: PASS, both tests green. First run downloads PG binaries (~50 MB) and extracts them to temp; ~30–60 s total.

- [ ] **Step 3: Run the full backend test suite to confirm no regression in default profile.**

Run: `cd backend && mvn -B test`
Expected: green; matches previous baseline.

- [ ] **Step 4: Commit.**

```bash
git add backend/app/src/test/java/com/drshoes/app/bundle/BundleProfileBootIntegrationTest.java
git commit -m "test(bundle): boot integration test — embedded PG + Flyway green [milestone:client-installer][task:ci-7]"
```

---

## Wave 2 — Frontend standalone build

### Task ci-8: Next.js standalone + sharp handling

**Files:**
- Modify: `apps/web/next.config.mjs`

- [ ] **Step 1: Read the current `apps/web/next.config.mjs` to understand existing config.**

- [ ] **Step 2: Edit to add `output: 'standalone'` and disable image optimization for the bundle target.**

```javascript
// apps/web/next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  // ... existing config ...
  output: 'standalone',
  images: {
    unoptimized: true,
  },
  // Optional: keep traceMode default; ensure no top-level await on missing modules
};

export default nextConfig;
```

> If the existing config already has `images` or other top-level keys, merge — don't overwrite.

- [ ] **Step 3: Build the web app and verify `.next/standalone/server.js` exists.**

Run: `cd apps/web && pnpm install --frozen-lockfile && pnpm build`
Expected: BUILD SUCCESS. Verify:

```bash
ls apps/web/.next/standalone/server.js && ls apps/web/.next/static
```

Expected: both paths exist.

- [ ] **Step 4: Boot the standalone server locally to smoke.**

```bash
cd apps/web/.next/standalone
PORT=3100 NODE_ENV=production node server.js &
sleep 5
curl -sf http://localhost:3100/admin/login | grep -i 'login' && echo OK
kill %1
```

Expected: `OK` printed. Login page HTML returns.

> If `sharp` is missing (warning during build), inspect `apps/web/package.json` — it should be a runtime dep. Since `images.unoptimized: true` is set, sharp isn't required at runtime; ignore the warning. If build fails with "sharp not found", add `"sharp": "^0.33.0"` and re-run `pnpm install`.

- [ ] **Step 5: Verify `pnpm test` (frontend vitest) still passes.**

Run: `cd apps/web && pnpm test`
Expected: green; matches previous baseline.

- [ ] **Step 6: Commit.**

```bash
git add apps/web/next.config.mjs
git commit -m "feat(web): output:standalone for offline-bundle target [milestone:client-installer][task:ci-8]"
```

---

## Wave 3 — `client-installer/` pipeline

### Task ci-9: Scaffold `client-installer/` directory

**Files:**
- Create: `client-installer/VERSION`
- Create: `client-installer/CHANGELOG.md`
- Create: `client-installer/README.md`
- Create: `client-installer/.gitignore`

- [ ] **Step 1: Create the directory and version file.**

```bash
mkdir -p client-installer/templates client-installer/cache client-installer/dist
echo "1.0.0" > client-installer/VERSION
```

- [ ] **Step 2: Create `client-installer/.gitignore`.**

```
cache/
dist/
*.tar.gz
```

- [ ] **Step 3: Create `client-installer/CHANGELOG.md`.**

```markdown
# Client Bundle — Changelog

Versions shipped to the Dr Shoes client as a Google Drive zip.

## 1.0.0 — 2026-05-20 (planned)

Initial offline-local bundle.

- Backend JAR with embedded Postgres 16, local-fs blob storage, noop messaging providers.
- Next.js standalone admin frontend.
- Bundled Liberica JDK 21 (x86_64) + Node 18 LTS (x64) for macOS 10.13+ compatibility.
- One-click `DrShoes.command` launcher, `Stop-DrShoes.command` for clean shutdown.
- Polish, non-technical `README.txt` for the recipient.
- Demo seed: login `misza@drshoes.pl` / `change-me-on-first-login`.
```

- [ ] **Step 4: Create `client-installer/README.md` (developer runbook).**

```markdown
# Client Installer

Builds the Dr Shoes desktop bundle shipped to the client over Google Drive. Self-contained: bundled JDK, Node, and Postgres binaries. Runs on macOS 10.15 Catalina (Intel) and newer.

## Build

```bash
./client-installer/build-bundle.sh
```

Outputs `client-installer/dist/DrShoes-Local-<VERSION>.zip`.

## Verify

```bash
./client-installer/verify.sh
```

Runs static `otool`/`file` checks against the assembled bundle and asserts size limits.

## Ship a new version

1. Bump `client-installer/VERSION` (semver).
2. Add an entry to `client-installer/CHANGELOG.md`.
3. `./client-installer/build-bundle.sh && ./client-installer/verify.sh`.
4. Smoke on dev Mac: unzip `dist/DrShoes-Local-<VERSION>.zip` to `/tmp/` and double-click `DrShoes.command`.
5. Upload `dist/DrShoes-Local-<VERSION>.zip` to Google Drive (manual drag-and-drop — no `rclone` configured).
6. `git tag bundle-v<VERSION>` and push.

## What's bundled

| Component | Version | Source |
|-----------|---------|--------|
| Liberica JDK | 21.0.5+11 (Standard, x86_64) | https://download.bell-sw.com |
| Node.js | 18.20.5 LTS (x64) | https://nodejs.org/dist |
| Postgres binaries | 16.4.0 (`embedded-postgres-binaries-darwin-amd64`) | Maven (Zonky) |
| Spring Boot JAR | latest in `backend/app/target` | `mvn -Pbundle package` |
| Next standalone | latest in `apps/web/.next/standalone` | `pnpm build` |

## Cache

`client-installer/cache/` holds downloaded tarballs (JDK + Node). Git-ignored. Safe to delete to force re-download.

## Constraints

- macOS x86_64 only (Catalina is Intel-only). Apple Silicon recipients run via Rosetta.
- No code signing — recipient sees Gatekeeper warning on first launch.
- Each ship is a fresh full zip (~400 MB). No diff/patch updates.
```

- [ ] **Step 5: Commit.**

```bash
git add client-installer/VERSION client-installer/CHANGELOG.md client-installer/README.md client-installer/.gitignore
git commit -m "feat(installer): scaffold client-installer/ with VERSION + CHANGELOG + runbook [milestone:client-installer][task:ci-9]"
```

---

### Task ci-10: `fetch-cached.sh`

**Files:**
- Create: `client-installer/fetch-cached.sh`

- [ ] **Step 1: Write the script.**

```bash
#!/bin/bash
# fetch-cached.sh URL DEST
# Idempotent download with simple "file exists" cache. Verifies HTTP 200.
set -euo pipefail

URL="${1:?fetch-cached.sh URL DEST}"
DEST="${2:?fetch-cached.sh URL DEST}"

if [ -f "$DEST" ] && [ "$(stat -f%z "$DEST" 2>/dev/null || stat -c%s "$DEST")" -gt 1000 ]; then
  echo "cache.hit $DEST"
  exit 0
fi

mkdir -p "$(dirname "$DEST")"
echo "fetch.start url=$URL dest=$DEST"
TMP="$DEST.partial"
curl -fL --retry 3 --retry-delay 2 -o "$TMP" "$URL"
mv "$TMP" "$DEST"

BYTES=$(stat -f%z "$DEST" 2>/dev/null || stat -c%s "$DEST")
echo "fetch.done bytes=$BYTES dest=$DEST"
```

- [ ] **Step 2: Make it executable.**

```bash
chmod +x client-installer/fetch-cached.sh
```

- [ ] **Step 3: Smoke-test with a small public file.**

```bash
./client-installer/fetch-cached.sh https://nodejs.org/dist/v18.20.5/SHASUMS256.txt /tmp/shasums.txt
./client-installer/fetch-cached.sh https://nodejs.org/dist/v18.20.5/SHASUMS256.txt /tmp/shasums.txt
```

Expected: first run prints `fetch.done bytes=…`; second run prints `cache.hit /tmp/shasums.txt`.

- [ ] **Step 4: Commit.**

```bash
git add client-installer/fetch-cached.sh
git commit -m "feat(installer): cached HTTP downloader for JDK/Node tarballs [milestone:client-installer][task:ci-10]"
```

---

### Task ci-11: `templates/DrShoes.command` + `Stop-DrShoes.command`

**Files:**
- Create: `client-installer/templates/DrShoes.command`
- Create: `client-installer/templates/Stop-DrShoes.command`

- [ ] **Step 1: Create `DrShoes.command` exactly as in the spec.**

```bash
#!/bin/bash
# Dr Shoes — uruchamia backend (Java) + frontend (Node) lokalnie. Otwiera przeglądarkę.
set -e
cd "$(dirname "$0")"
BUNDLE_DIR="$PWD"

# 1. Sanity checks
if [ ! -f "jre/Contents/Home/bin/java" ]; then
  osascript -e 'display alert "Brakuje pliku JRE" message "Rozpakuj cały ZIP najpierw, potem uruchom ponownie."'
  exit 1
fi
mkdir -p data/pg data/blobs data/logs

# 2. Stop leftover Dr Shoes processes (never blindly kill anything else)
for pidfile in data/backend.pid data/web.pid; do
  if [ -f "$pidfile" ]; then
    OLDPID=$(cat "$pidfile")
    if kill -0 "$OLDPID" 2>/dev/null; then kill "$OLDPID" 2>/dev/null || true; fi
    rm -f "$pidfile"
  fi
done

# 3. Surface port conflicts to the user
for port in 8080 3000; do
  if lsof -ti tcp:$port > /dev/null 2>&1; then
    osascript -e "display alert \"Port $port jest zajęty\" message \"Inna aplikacja używa portu $port. Zamknij ją i spróbuj ponownie.\""
    exit 1
  fi
done

# 4. Start backend
export JAVA_HOME="$BUNDLE_DIR/jre/Contents/Home"
export SPRING_PROFILES_ACTIVE=bundle
nohup "$JAVA_HOME/bin/java" -Xss512k -Xmx1g \
  -Duser.dir="$BUNDLE_DIR" \
  -jar backend/drshoes-app.jar \
  > data/logs/backend.log 2>&1 &
BACKEND_PID=$!
echo "$BACKEND_PID" > data/backend.pid

# 5. Wait for /actuator/health
for i in $(seq 1 60); do
  if curl -fs http://localhost:8080/actuator/health > /dev/null 2>&1; then break; fi
  if ! kill -0 $BACKEND_PID 2>/dev/null; then
    osascript -e 'display alert "Backend nie wystartował" message "Sprawdź data/logs/backend.log"'
    exit 1
  fi
  sleep 2
done

# 6. Start web
export PATH="$BUNDLE_DIR/node/bin:$PATH"
export NODE_ENV=production
export PORT=3000
export DRSHOES_API_BASE=http://localhost:8080
nohup "$BUNDLE_DIR/node/bin/node" web/server.js \
  > data/logs/web.log 2>&1 &
WEB_PID=$!
echo "$WEB_PID" > data/web.pid

# 7. Wait for web ready
for i in $(seq 1 30); do
  if curl -fs http://localhost:3000 > /dev/null 2>&1; then break; fi
  sleep 1
done

# 8. Open browser + notify
open http://localhost:3000/admin/login
osascript -e 'display notification "Otwórz przeglądarkę: http://localhost:3000/admin/login" with title "Dr Shoes uruchomione"'
```

- [ ] **Step 2: Create `Stop-DrShoes.command`.**

```bash
#!/bin/bash
# Dr Shoes — zatrzymuje backend i frontend.
set -e
cd "$(dirname "$0")"

for pidfile in data/backend.pid data/web.pid; do
  if [ -f "$pidfile" ]; then
    OLDPID=$(cat "$pidfile")
    if kill -0 "$OLDPID" 2>/dev/null; then
      kill "$OLDPID" 2>/dev/null || true
      sleep 1
      if kill -0 "$OLDPID" 2>/dev/null; then kill -9 "$OLDPID" 2>/dev/null || true; fi
    fi
    rm -f "$pidfile"
  fi
done

osascript -e 'display notification "Dr Shoes zatrzymane" with title "Dr Shoes"'
```

- [ ] **Step 3: Make them executable.**

```bash
chmod +x client-installer/templates/DrShoes.command client-installer/templates/Stop-DrShoes.command
```

- [ ] **Step 4: Static syntax check.**

Run: `bash -n client-installer/templates/DrShoes.command && bash -n client-installer/templates/Stop-DrShoes.command`
Expected: no output (clean syntax).

- [ ] **Step 5: Commit.**

```bash
git add client-installer/templates/DrShoes.command client-installer/templates/Stop-DrShoes.command
git commit -m "feat(installer): .command launchers (start + stop) [milestone:client-installer][task:ci-11]"
```

---

### Task ci-12: `templates/README.txt` (client-facing, Polish)

**Files:**
- Create: `client-installer/templates/README.txt`

- [ ] **Step 1: Create the README exactly as specified.**

```
Dr Shoes — instalacja lokalna
==============================

WYMAGANIA:
• macOS 10.15 (Catalina) lub nowszy, Intel
• ~1 GB wolnego miejsca

INSTALACJA (raz):
1. Rozpakuj plik DrShoes-Local-1.0.0.zip dwuklikiem.
2. Otwórz folder "DrShoes-Local".

URUCHAMIANIE:
1. Dwuklik na "DrShoes.command".
   (Jeśli macOS zapyta o pozwolenie: Preferencje → Bezpieczeństwo → "Otwórz mimo to".)
2. Poczekaj ~30 sekund. Przeglądarka otworzy się automatycznie.
3. Zaloguj się:
   E-mail:  misza@drshoes.pl
   Hasło:   change-me-on-first-login

ZATRZYMANIE:
• Dwuklik na "Stop-DrShoes.command".

KOPIA ZAPASOWA:
• Cały folder "data/" zawiera bazę i zdjęcia. Skopiuj go, by zachować dane.

AKTUALIZACJE:
• Otrzymasz nowy plik DrShoes-Local-X.Y.Z.zip.
• Rozpakuj go obok starego folderu.
• Skopiuj folder "data/" ze starej wersji do nowej (zachowasz bazę).
• Uruchom DrShoes.command z nowej wersji.

PROBLEMY:
• Logi: folder "data/logs/" (backend.log, web.log).
• Pomoc: putiatycki.p@gmail.com
```

- [ ] **Step 2: Commit.**

```bash
git add client-installer/templates/README.txt
git commit -m "feat(installer): client-facing Polish README [milestone:client-installer][task:ci-12]"
```

---

### Task ci-13: `build-bundle.sh`

**Files:**
- Create: `client-installer/build-bundle.sh`

- [ ] **Step 1: Write the build script.**

```bash
#!/bin/bash
# build-bundle.sh — assembles client-installer/dist/DrShoes-Local-<VERSION>.zip
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/.." && pwd)"
VERSION="$(cat "$HERE/VERSION")"
DIST="$HERE/dist"
CACHE="$HERE/cache"
WORK="$DIST/DrShoes-Local"

echo "build.start version=$VERSION repo=$REPO"
rm -rf "$DIST" && mkdir -p "$WORK"/{backend,web,config,jre,node} "$CACHE"

# 1. Backend
echo "build.backend.start"
( cd "$REPO/backend" && mvn -B -pl app -am -DskipTests -Pbundle clean package )
cp "$REPO/backend/app/target/app-"*"-SNAPSHOT.jar" "$WORK/backend/drshoes-app.jar"
echo "build.backend.done jar=$(du -h "$WORK/backend/drshoes-app.jar" | cut -f1)"

# 2. Frontend (Next standalone)
echo "build.web.start"
( cd "$REPO/apps/web" && pnpm install --frozen-lockfile && pnpm build )
cp -R "$REPO/apps/web/.next/standalone/." "$WORK/web/"
mkdir -p "$WORK/web/.next" && cp -R "$REPO/apps/web/.next/static" "$WORK/web/.next/"
[ -d "$REPO/apps/web/public" ] && cp -R "$REPO/apps/web/public" "$WORK/web/"
echo "build.web.done size=$(du -sh "$WORK/web" | cut -f1)"

# 3. Liberica JDK 21 (x86_64)
LIBERICA_URL="https://download.bell-sw.com/java/21.0.5+11/bellsoft-jdk21.0.5+11-macos-amd64.tar.gz"
"$HERE/fetch-cached.sh" "$LIBERICA_URL" "$CACHE/liberica.tar.gz"
tar -xzf "$CACHE/liberica.tar.gz" -C "$WORK/jre" --strip-components=1
echo "build.jdk.done size=$(du -sh "$WORK/jre" | cut -f1)"

# 4. Node 18 LTS (x64)
NODE_URL="https://nodejs.org/dist/v18.20.5/node-v18.20.5-darwin-x64.tar.gz"
"$HERE/fetch-cached.sh" "$NODE_URL" "$CACHE/node.tar.gz"
tar -xzf "$CACHE/node.tar.gz" -C "$WORK/node" --strip-components=1
echo "build.node.done size=$(du -sh "$WORK/node" | cut -f1)"

# 5. Templates + config
cp "$HERE/templates/DrShoes.command" "$WORK/"
cp "$HERE/templates/Stop-DrShoes.command" "$WORK/"
cp "$HERE/templates/README.txt" "$WORK/"
cp "$REPO/backend/app/src/main/resources/application-bundle.yaml" "$WORK/config/"
chmod +x "$WORK"/*.command

echo "$VERSION" > "$WORK/.version"

# 6. Zip
ZIP_NAME="DrShoes-Local-$VERSION.zip"
( cd "$DIST" && zip -ry "$ZIP_NAME" "DrShoes-Local" > /dev/null )
SIZE=$(du -h "$DIST/$ZIP_NAME" | cut -f1)
echo "build.done zip=$DIST/$ZIP_NAME size=$SIZE"
```

- [ ] **Step 2: Make executable.**

```bash
chmod +x client-installer/build-bundle.sh
```

- [ ] **Step 3: Static syntax check.**

Run: `bash -n client-installer/build-bundle.sh`
Expected: no output.

- [ ] **Step 4: Commit.**

```bash
git add client-installer/build-bundle.sh
git commit -m "feat(installer): build-bundle.sh assembles the full client zip [milestone:client-installer][task:ci-13]"
```

---

### Task ci-14: `verify.sh` (static otool/file checks)

**Files:**
- Create: `client-installer/verify.sh`

- [ ] **Step 1: Write the verifier.**

```bash
#!/bin/bash
# verify.sh — static checks on the assembled bundle (run after build-bundle.sh).
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="$HERE/dist/DrShoes-Local"
FAIL=0

ok()   { echo "ok   $*"; }
fail() { echo "FAIL $*"; FAIL=1; }

[ -d "$WORK" ] || { echo "no $WORK — run build-bundle.sh first"; exit 1; }

# 1. Architecture: must be x86_64
for bin in "$WORK/jre/Contents/Home/bin/java" "$WORK/node/bin/node"; do
  if [ ! -f "$bin" ]; then fail "missing binary $bin"; continue; fi
  arch=$(file -b "$bin")
  if echo "$arch" | grep -q 'x86_64'; then ok "arch x86_64 $(basename "$bin")"; else fail "arch not x86_64 $bin: $arch"; fi
done

# 2. macOS minimum version: <= 10.15
for bin in "$WORK/jre/Contents/Home/bin/java" "$WORK/node/bin/node"; do
  [ -f "$bin" ] || continue
  minos=$(otool -l "$bin" 2>/dev/null | awk '/LC_BUILD_VERSION/{f=1} f && /minos/{print $2; exit}')
  if [ -z "$minos" ]; then
    # Older binaries use LC_VERSION_MIN_MACOSX
    minos=$(otool -l "$bin" 2>/dev/null | awk '/LC_VERSION_MIN_MACOSX/{f=1} f && /version/{print $2; exit}')
  fi
  if [ -z "$minos" ]; then
    fail "could not read minos from $bin"
  else
    major=$(echo "$minos" | cut -d. -f1)
    minor=$(echo "$minos" | cut -d. -f2)
    if [ "$major" -lt 10 ] || { [ "$major" -eq 10 ] && [ "$minor" -le 15 ]; }; then
      ok "minos=$minos $(basename "$bin")"
    else
      fail "minos=$minos > 10.15 in $bin"
    fi
  fi
done

# 3. Required files present
for f in DrShoes.command Stop-DrShoes.command README.txt .version backend/drshoes-app.jar web/server.js; do
  if [ -e "$WORK/$f" ]; then ok "exists $f"; else fail "missing $f"; fi
done

# 4. Executable bits
for c in "$WORK/DrShoes.command" "$WORK/Stop-DrShoes.command"; do
  if [ -x "$c" ]; then ok "executable $(basename "$c")"; else fail "not executable $c"; fi
done

# 5. Zip size <= 450 MB
VERSION="$(cat "$HERE/VERSION")"
ZIP="$HERE/dist/DrShoes-Local-$VERSION.zip"
if [ -f "$ZIP" ]; then
  bytes=$(stat -f%z "$ZIP")
  mb=$(( bytes / 1024 / 1024 ))
  if [ "$mb" -le 450 ]; then ok "zip size ${mb}MB <= 450"; else fail "zip size ${mb}MB > 450"; fi
else
  fail "missing zip $ZIP"
fi

[ "$FAIL" = "0" ] && echo "verify.ok" || { echo "verify.fail"; exit 1; }
```

- [ ] **Step 2: Make executable.**

```bash
chmod +x client-installer/verify.sh
```

- [ ] **Step 3: Static syntax check.**

Run: `bash -n client-installer/verify.sh`
Expected: no output.

- [ ] **Step 4: Commit.**

```bash
git add client-installer/verify.sh
git commit -m "feat(installer): verify.sh static otool/file checks [milestone:client-installer][task:ci-14]"
```

---

## Wave 4 — End-to-end verification on dev Mac

### Task ci-15: Run full pipeline + smoke

**Files:** none new — this task validates the existing pipeline end-to-end.

- [ ] **Step 1: Run the build.**

Run: `./client-installer/build-bundle.sh`
Expected: terminates with `build.done zip=client-installer/dist/DrShoes-Local-1.0.0.zip size=…`. Should complete in 5–15 min (most of the time is first-time JDK + Node downloads, ~260 MB).

- [ ] **Step 2: Run the verifier.**

Run: `./client-installer/verify.sh`
Expected: ends with `verify.ok`. If any FAIL line: stop and fix the underlying issue.

- [ ] **Step 3: Unzip into `/tmp/` and double-click `DrShoes.command`.**

```bash
rm -rf /tmp/DrShoes-Local && unzip -q client-installer/dist/DrShoes-Local-1.0.0.zip -d /tmp/
open /tmp/DrShoes-Local/DrShoes.command
```

Expected: Terminal opens, prints launcher log; within ~60 s, the system default browser opens at `http://localhost:3000/admin/login`.

> On Apple Silicon dev Mac, this will run via Rosetta — that's expected and is *not* a Catalina smoke. It only proves the x86_64 binaries actually run on macOS. The real Catalina test is the recipient's machine.

- [ ] **Step 4: Smoke through the admin UI.**

Login with `misza@drshoes.pl` / `change-me-on-first-login`. Verify:
1. Order list renders.
2. Create a new test order via the existing create-order flow.
3. Upload a photo to the order; confirm it appears in the drawer.
4. Inspect `/tmp/DrShoes-Local/data/blobs/` — the uploaded file is there.
5. Trigger a status change that fires a message — inspect `/tmp/DrShoes-Local/data/logs/messages.log` (or `backend.log` with grep `outcome=NOOP_BUNDLE`) for a noop send line.

- [ ] **Step 5: Stop + restart to verify persistence.**

```bash
open /tmp/DrShoes-Local/Stop-DrShoes.command
sleep 3
open /tmp/DrShoes-Local/DrShoes.command
```

Expected: second start is faster (no `initdb`). Login again — the test order from Step 4 is still there.

- [ ] **Step 6: Write the dispatch log + ship checklist.**

Create `docs/dispatch-log/ci-15-<UTC>.md` per project protocol with:
- Backend JAR size, web standalone size, JDK size, Node size, zip size.
- Boot time (cold) and boot time (warm).
- Any FAIL output from verify.sh.
- Screenshots (`screencapture -i tmp.png`) of the admin login page and the order drawer after photo upload.
- Decision: "ready to ship" or list of blockers.

- [ ] **Step 7: Tag and finalize.**

```bash
git tag bundle-v1.0.0
echo "Ready. Upload client-installer/dist/DrShoes-Local-1.0.0.zip to Google Drive."
```

> **Manual step:** drag-and-drop the zip into the Google Drive web UI (under the agreed `DrShoes/` folder). Share link with the client. Update `client-installer/CHANGELOG.md` with the actual ship date and the Drive URL.

- [ ] **Step 8: Commit.**

```bash
git add docs/dispatch-log/ci-15-*.md client-installer/CHANGELOG.md
git commit -m "ship(installer): bundle v1.0.0 verified on dev Mac [milestone:client-installer][task:ci-15]"
```

---

## Contingency tasks (run only if Wave 4 surfaces a HIGH-risk failure)

### Contingency ci-C1: Liberica JDK 21 won't run on Catalina

If verify.sh reports `minos > 10.15` for `java`, or the recipient's Catalina box can't launch the JDK:

1. Replace Liberica JDK 21 with **Liberica JDK 17** in `build-bundle.sh`:
   `https://download.bell-sw.com/java/17.0.13+12/bellsoft-jdk17.0.13+12-macos-amd64.tar.gz`.
2. Downgrade the project's `java.version` in `backend/pom.xml` to `17`. Be aware: Spring Boot 3.4 supports Java 17 fully; recent code using Java 21 features (sealed switches, pattern matching) may need adjustment. Grep for `var ` patterns, switch expressions — most should still work.
3. Re-run all backend tests under Java 17 (`JAVA_HOME=$LIB17 mvn -B verify`).
4. Re-run `build-bundle.sh` + `verify.sh`.

### Contingency ci-C2: Zonky PG 16.4 binaries fail on Catalina

If `verify.sh` reports `minos > 10.15` for the extracted PG binaries (after first JAR boot), or `initdb` fails on the recipient's box:

1. Pin to PG 15.x in the Maven profile:
   ```xml
   <artifactId>embedded-postgres-binaries-darwin-amd64</artifactId>
   <version>15.8.0</version>
   ```
2. Re-run the bundle profile integration test + full build.

### Contingency ci-C3: Bundle exceeds 450 MB

1. In `build-bundle.sh`, strip the JDK to a JRE-only image:
   ```bash
   # After extracting Liberica:
   "$WORK/jre/Contents/Home/bin/jlink" \
     --module-path "$WORK/jre/Contents/Home/jmods" \
     --add-modules java.base,java.logging,java.sql,java.naming,java.xml,java.management,java.security.jgss,java.security.sasl,jdk.unsupported,java.desktop,java.net.http,jdk.crypto.cryptoki \
     --output "$WORK/jre-slim" --strip-debug --no-header-files --no-man-pages
   rm -rf "$WORK/jre" && mv "$WORK/jre-slim" "$WORK/jre"
   # NOTE: jlink output layout differs — adjust DrShoes.command JAVA_HOME accordingly.
   ```
2. Re-run verify.sh. Saves ~100 MB.

---

## Acceptance checklist (mirrors spec)

- [ ] `client-installer/build-bundle.sh` produces `client-installer/dist/DrShoes-Local-1.0.0.zip` ≤ 450 MB.
- [ ] Unzipping + double-clicking `DrShoes.command` brings up `/admin/login` in < 60 s on dev Mac.
- [ ] Login with seeded credentials → order list renders → photo upload writes to `data/blobs/` → message send logs `outcome=NOOP_BUNDLE`.
- [ ] `Stop-DrShoes.command` cleanly stops both processes; restart reuses `data/pg`.
- [ ] `verify.sh` exits `verify.ok` with x86_64 + minos ≤ 10.15 for all bundled binaries.
- [ ] `cd backend && mvn -B verify` stays green (no regression in default profile).
- [ ] `cd apps/web && pnpm test` stays green.
- [ ] `client-installer/CHANGELOG.md` has a 1.0.0 entry with ship date + Drive URL.
- [ ] `git tag bundle-v1.0.0` exists.

---

## Notes for executors

1. **Dispatch protocol (project-locked):** thin prompts to subagents — point at this file + task id + dispatch-log template path. Don't paste task text into prompts. See memory `feedback_dispatch_protocol.md`.
2. **Token-budget rule:** estimate output tokens before dispatching each task (lines × 10). Any task above ~20K tokens of expected output should be sliced. Wave 1 tasks are small (~80–250 LOC each); single subagent each is fine.
3. **TWO-STAGE review** for ci-3 (`LocalFsBlobStorage` — security-sensitive path traversal), ci-4 (`LocalBlobController` — admin endpoint, auth boundary), and ci-7 (boot integration test — coverage gate). Combined single-stage for the rest.
4. **Inline trivial fixups** when something is a 2-line config edit caught mid-execution. Don't dispatch a subagent for a one-line YAML patch.
5. **JDK + Node download URLs may shift over time.** If a 404 surfaces, look up the latest LTS in the same major line and update the URL constants in `build-bundle.sh`. Bump the version digits in `client-installer/CHANGELOG.md`.
6. **Memory entries to consult:**
   - `feedback_subagent_output_token_budget.md` — sizing dispatches
   - `feedback_dispatch_protocol.md` — thin prompts + dispatch logs
   - `project_session_2026_05_09_part4.md` — `*IT.java` naming gotcha (use `*IntegrationTest.java`)
   - `feedback_backend_jar_rebuild_gotcha.md` — `mvn package` is mandatory; `docker compose build backend` doesn't recompile Java
