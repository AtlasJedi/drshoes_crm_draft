package com.drshoes.lib.storage;

import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

import java.io.IOException;
import java.io.InputStream;
import java.time.Duration;
import java.time.Instant;

public class S3BlobStorage implements BlobStorage {

    private final S3Client client;
    private final S3Presigner presigner;
    private final String bucket;

    public S3BlobStorage(S3Client client, S3Presigner presigner, String bucket) {
        this.client = client;
        this.presigner = presigner;
        this.bucket = bucket;
    }

    @Override
    public void put(BlobKey key, InputStream stream, BlobMetadata meta) {
        try (stream) {
            client.putObject(
                PutObjectRequest.builder()
                    .bucket(bucket).key(key.value())
                    .contentType(meta.contentType())
                    .contentLength(meta.contentLength())
                    .build(),
                RequestBody.fromInputStream(stream, meta.contentLength()));
        } catch (IOException e) {
            throw new RuntimeException("upload failed for " + key.value(), e);
        }
    }

    @Override
    public InputStream get(BlobKey key) {
        return client.getObject(
            software.amazon.awssdk.services.s3.model.GetObjectRequest.builder()
                .bucket(bucket).key(key.value()).build());
    }

    @Override
    public boolean exists(BlobKey key) {
        try {
            client.headObject(HeadObjectRequest.builder().bucket(bucket).key(key.value()).build());
            return true;
        } catch (NoSuchKeyException e) {
            return false;
        }
    }

    @Override
    public PresignedUrl presignGet(BlobKey key, Duration ttl) {
        var presigned = presigner.presignGetObject(GetObjectPresignRequest.builder()
                .signatureDuration(ttl)
                .getObjectRequest(GetObjectRequest.builder().bucket(bucket).key(key.value()).build())
                .build());
        return new PresignedUrl(presigned.url().toString(), Instant.now().plus(ttl));
    }

    @Override
    public PresignedUrl presignPut(BlobKey key, Duration ttl, BlobMetadata expected) {
        var presigned = presigner.presignPutObject(PutObjectPresignRequest.builder()
                .signatureDuration(ttl)
                .putObjectRequest(PutObjectRequest.builder()
                        .bucket(bucket).key(key.value())
                        .contentType(expected.contentType())
                        .contentLength(expected.contentLength())
                        .build())
                .build());
        return new PresignedUrl(presigned.url().toString(), Instant.now().plus(ttl));
    }

    @Override
    public void delete(BlobKey key) {
        client.deleteObject(DeleteObjectRequest.builder().bucket(bucket).key(key.value()).build());
    }
}
