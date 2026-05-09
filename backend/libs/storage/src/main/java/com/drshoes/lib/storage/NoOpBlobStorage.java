package com.drshoes.lib.storage;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.time.Duration;
import java.time.Instant;

/**
 * No-op BlobStorage implementation for use in tests and offline scenarios.
 *
 * {@code get()} returns an empty stream. {@code put()} and {@code delete()} are no-ops.
 * {@code exists()} always returns false. Presign methods return a placeholder URL.
 */
public class NoOpBlobStorage implements BlobStorage {

    @Override
    public void put(BlobKey key, InputStream stream, BlobMetadata metadata) {
        // no-op
    }

    @Override
    public InputStream get(BlobKey key) {
        return new ByteArrayInputStream(new byte[0]);
    }

    @Override
    public boolean exists(BlobKey key) {
        return false;
    }

    @Override
    public PresignedUrl presignGet(BlobKey key, Duration ttl) {
        return new PresignedUrl("http://localhost/noop/" + key.value(), Instant.now().plus(ttl));
    }

    @Override
    public PresignedUrl presignPut(BlobKey key, Duration ttl, BlobMetadata expected) {
        return new PresignedUrl("http://localhost/noop/" + key.value(), Instant.now().plus(ttl));
    }

    @Override
    public void delete(BlobKey key) {
        // no-op
    }
}
