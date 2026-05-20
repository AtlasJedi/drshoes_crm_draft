package com.drshoes.lib.storage;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;

/**
 * Local-filesystem BlobStorage implementation for the offline client-bundle profile.
 *
 * <p>Security contract: every key is resolved against a normalized, absolute {@code root}.
 * After resolution and normalization, the resulting path must still start with {@code root}.
 * This blocks classic {@code ../} traversal, chains of {@code ./..}, and any other path
 * that escapes the sandbox — even if {@code BlobKey} accepted the raw value.
 *
 * <p>{@code root} itself is normalized at construction time so that comparisons are
 * always between two consistently-normalized paths (avoids false negatives from e.g.
 * trailing slashes or double-separators in the configured root path).
 */
public class LocalFsBlobStorage implements BlobStorage {

    private static final Logger log = LoggerFactory.getLogger(LocalFsBlobStorage.class);

    private final Path root; // absolute + normalized at construction

    public LocalFsBlobStorage(Path root) {
        this.root = root.toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.root);
        } catch (IOException e) {
            throw new IllegalStateException("Cannot create blob root: " + this.root, e);
        }
        log.info("blob.local.init root={}", this.root);
    }

    // ── BlobStorage interface ────────────────────────────────────────────────────

    @Override
    public void put(BlobKey key, InputStream stream, BlobMetadata metadata) {
        Path p = resolve(key);
        try {
            Files.createDirectories(p.getParent());
            try (OutputStream out = Files.newOutputStream(p)) {
                stream.transferTo(out);
            }
            log.info("blob.local.put key={} contentType={} outcome=ok", key.value(), metadata.contentType());
        } catch (IOException e) {
            throw new RuntimeException("Blob write failed: " + key.value(), e);
        }
    }

    @Override
    public InputStream get(BlobKey key) {
        Path p = resolve(key);
        try {
            return Files.newInputStream(p);
        } catch (NoSuchFileException e) {
            log.warn("blob.local.get key={} outcome=miss", key.value());
            throw new RuntimeException("Blob not found: " + key.value(), e);
        } catch (IOException e) {
            throw new RuntimeException("Blob read failed: " + key.value(), e);
        }
    }

    @Override
    public boolean exists(BlobKey key) {
        Path p = resolve(key);
        return Files.exists(p);
    }

    @Override
    public void delete(BlobKey key) {
        Path p = resolve(key);
        try {
            Files.deleteIfExists(p);
            log.info("blob.local.delete key={} outcome=ok", key.value());
        } catch (IOException e) {
            throw new RuntimeException("Blob delete failed: " + key.value(), e);
        }
    }

    @Override
    public PresignedUrl presignGet(BlobKey key, Duration ttl) {
        // Validate key before returning a URL — traversal check applies here too.
        resolve(key);
        return new PresignedUrl("/api/admin/photos/local/" + key.value(), Instant.now().plus(ttl));
    }

    @Override
    public PresignedUrl presignPut(BlobKey key, Duration ttl, BlobMetadata expected) {
        resolve(key);
        return new PresignedUrl("/api/admin/photos/local/" + key.value(), Instant.now().plus(ttl));
    }

    // ── internal ────────────────────────────────────────────────────────────────

    /**
     * Resolves {@code key.value()} against {@code root}, normalizes the result, and
     * asserts it remains inside {@code root}.
     *
     * <p>Note: {@code root} is already normalized (see constructor), so
     * {@code resolved.startsWith(root)} is a reliable containment check.
     */
    private Path resolve(BlobKey key) {
        // root.resolve() interprets the value as a relative path component.
        // normalize() collapses any "." or ".." segments.
        Path resolved = root.resolve(key.value()).normalize();
        if (!resolved.startsWith(root)) {
            log.warn("blob.local.security key={} resolved={} root={} outcome=traversal_blocked",
                key.value(), resolved, root);
            throw new IllegalArgumentException(
                "Path traversal blocked: key '" + key.value() + "' resolves outside blob root");
        }
        return resolved;
    }
}
