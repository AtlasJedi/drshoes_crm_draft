package com.drshoes.lib.storage;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LocalFsBlobStorageTest {

    // ── happy-path ─────────────────────────────────────────────────────────────

    @Test
    void put_then_get_round_trips_bytes(@TempDir Path root) throws Exception {
        LocalFsBlobStorage storage = new LocalFsBlobStorage(root);
        BlobKey key = new BlobKey("photos/2026/05/abc.jpg");
        byte[] payload = "hello".getBytes();

        storage.put(key, new ByteArrayInputStream(payload), new BlobMetadata("image/jpeg", (long) payload.length));

        try (InputStream got = storage.get(key)) {
            assertThat(got.readAllBytes()).isEqualTo(payload);
        }
    }

    @Test
    void get_missing_key_throws(@TempDir Path root) {
        LocalFsBlobStorage storage = new LocalFsBlobStorage(root);
        assertThatThrownBy(() -> storage.get(new BlobKey("photos/missing.jpg")))
            .isInstanceOf(RuntimeException.class)
            .hasMessageContaining("missing.jpg");
    }

    @Test
    void delete_removes_file(@TempDir Path root) throws Exception {
        LocalFsBlobStorage storage = new LocalFsBlobStorage(root);
        BlobKey key = new BlobKey("photos/del.jpg");
        byte[] data = {1, 2, 3};
        storage.put(key, new ByteArrayInputStream(data), new BlobMetadata("application/octet-stream", (long) data.length));
        assertThat(Files.exists(root.resolve("photos/del.jpg"))).isTrue();

        storage.delete(key);

        assertThat(Files.exists(root.resolve("photos/del.jpg"))).isFalse();
    }

    @Test
    void presigned_get_returns_local_url(@TempDir Path root) {
        LocalFsBlobStorage storage = new LocalFsBlobStorage(root);
        BlobKey key = new BlobKey("photos/2026/05/abc.jpg");

        PresignedUrl url = storage.presignGet(key, Duration.ofMinutes(15));

        assertThat(url.url()).isEqualTo("/api/admin/photos/local/photos/2026/05/abc.jpg");
        assertThat(url.expiresAt()).isAfter(java.time.Instant.now());
    }

    @Test
    void presigned_put_returns_local_url(@TempDir Path root) {
        LocalFsBlobStorage storage = new LocalFsBlobStorage(root);
        BlobKey key = new BlobKey("photos/2026/05/abc.jpg");

        PresignedUrl url = storage.presignPut(key, Duration.ofMinutes(15), new BlobMetadata("image/jpeg", 100L));

        assertThat(url.url()).isEqualTo("/api/admin/photos/local/photos/2026/05/abc.jpg");
        assertThat(url.expiresAt()).isAfter(java.time.Instant.now());
    }

    @Test
    void exists_returns_true_after_put_and_false_before(@TempDir Path root) throws Exception {
        LocalFsBlobStorage storage = new LocalFsBlobStorage(root);
        BlobKey key = new BlobKey("photos/exists-check.jpg");

        assertThat(storage.exists(key)).isFalse();

        byte[] data = "content".getBytes();
        storage.put(key, new ByteArrayInputStream(data), new BlobMetadata("image/jpeg", (long) data.length));

        assertThat(storage.exists(key)).isTrue();
    }

    // ── path-traversal security ─────────────────────────────────────────────────

    /**
     * Classic ../ traversal that escapes root.
     * BlobKey("../escaped.jpg") is accepted at construction (no leading '/'), but
     * after resolve + normalize it lands at root.parent/escaped.jpg — outside root.
     * LocalFsBlobStorage.resolve() MUST detect and reject this.
     *
     * Note: "photos/../escaped.jpg" does NOT escape root — it resolves to
     * root/escaped.jpg which is still inside root. The dangerous form is a leading
     * ".." segment (or enough ".." to climb above root).
     */
    @Test
    void put_blocks_dotdot_traversal(@TempDir Path root) {
        LocalFsBlobStorage storage = new LocalFsBlobStorage(root);
        // "../escaped.jpg" -> root.parent/escaped.jpg — outside root
        assertThatThrownBy(() -> storage.put(
                new BlobKey("../escaped.jpg"),
                new ByteArrayInputStream(new byte[]{1}),
                new BlobMetadata("image/jpeg", 1L)))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("traversal");
    }

    /**
     * Multi-hop ../ traversal on get(): "photos/../../etc/passwd"
     * resolves to root.parent/etc/passwd — outside root.
     */
    @Test
    void get_blocks_dotdot_traversal(@TempDir Path root) {
        LocalFsBlobStorage storage = new LocalFsBlobStorage(root);
        assertThatThrownBy(() -> storage.get(new BlobKey("photos/../../etc/passwd")))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("traversal");
    }

    /**
     * Leading-segment ../ traversal on delete().
     */
    @Test
    void delete_blocks_dotdot_traversal(@TempDir Path root) {
        LocalFsBlobStorage storage = new LocalFsBlobStorage(root);
        assertThatThrownBy(() -> storage.delete(new BlobKey("../escaped.jpg")))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("traversal");
    }

    /**
     * Absolute-path injection: BlobKey("photos/2026/05/abc.jpg") is safe, but
     * what if an attacker manages to inject an absolute path? BlobKey already
     * rejects leading '/' ("not start with '/'"), so new BlobKey("/etc/passwd")
     * throws at construction. Verify that BlobKey itself is the first defense line
     * so that LocalFsBlobStorage never even sees an absolute path.
     */
    @Test
    void blobkey_rejects_absolute_path_at_construction() {
        assertThatThrownBy(() -> new BlobKey("/etc/passwd"))
            .isInstanceOf(IllegalArgumentException.class);
    }

    /**
     * Double-encoded traversal: "photos/%2e%2e/escaped.jpg".
     * URL-encoding belongs at the HTTP layer; BlobKey stores the already-decoded value.
     * If a caller naively passes percent-encoded bytes, the resolved path stays inside
     * root because "%2e%2e" ≠ "..". This test documents the expectation that
     * percent-encoded segments are NOT decoded by LocalFsBlobStorage.
     */
    @Test
    void put_does_not_decode_percent_encoded_segments(@TempDir Path root) throws Exception {
        LocalFsBlobStorage storage = new LocalFsBlobStorage(root);
        // "%2e%2e" is literally the string, not "..". Resolve stays inside root.
        BlobKey key = new BlobKey("photos/%2e%2e/encoded.jpg");
        byte[] data = "ok".getBytes();

        // Must NOT throw — the literal "%2e%2e" directory name is benign.
        storage.put(key, new ByteArrayInputStream(data), new BlobMetadata("image/jpeg", (long) data.length));

        assertThat(Files.exists(root.resolve("photos/%2e%2e/encoded.jpg"))).isTrue();
    }

    /**
     * Null-byte injection: "photos/\0evil.jpg".
     * Java's Path API on most OSes will throw on a null byte.
     * Verify that LocalFsBlobStorage surfaces the error cleanly (any RuntimeException).
     */
    @Test
    void put_rejects_null_byte_in_key(@TempDir Path root) {
        LocalFsBlobStorage storage = new LocalFsBlobStorage(root);
        assertThatThrownBy(() -> storage.put(
                new BlobKey("photos/\0evil.jpg"),
                new ByteArrayInputStream(new byte[]{1}),
                new BlobMetadata("image/jpeg", 1L)))
            .isInstanceOf(RuntimeException.class);
    }
}
