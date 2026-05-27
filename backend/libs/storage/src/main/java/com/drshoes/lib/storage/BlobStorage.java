package com.drshoes.lib.storage;

import java.io.InputStream;
import java.time.Duration;

public interface BlobStorage {
    void put(BlobKey key, InputStream stream, BlobMetadata metadata);
    InputStream get(BlobKey key);
    boolean exists(BlobKey key);
    PresignedUrl presignGet(BlobKey key, Duration ttl);
    PresignedUrl presignPut(BlobKey key, Duration ttl, BlobMetadata expected);
    void delete(BlobKey key);
}
