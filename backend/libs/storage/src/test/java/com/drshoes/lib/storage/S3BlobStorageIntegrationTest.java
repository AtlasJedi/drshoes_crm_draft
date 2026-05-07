package com.drshoes.lib.storage;

import org.junit.jupiter.api.Test;
import org.testcontainers.containers.MinIOContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.CreateBucketRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

import java.io.ByteArrayInputStream;
import java.net.URI;
import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;

@Testcontainers
class S3BlobStorageIntegrationTest {

    @Container
    static MinIOContainer minio = new MinIOContainer("minio/minio:RELEASE.2024-10-13T13-34-11Z")
            .withUserName("test").withPassword("test1234");

    @Test
    void put_then_exists_then_presign_get() throws Exception {
        var client = S3Client.builder()
                .endpointOverride(URI.create(minio.getS3URL()))
                .region(Region.US_EAST_1)
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create("test", "test1234")))
                .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true).build())
                .build();
        var presigner = S3Presigner.builder()
                .endpointOverride(URI.create(minio.getS3URL()))
                .region(Region.US_EAST_1)
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create("test", "test1234")))
                .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true).build())
                .build();
        client.createBucket(CreateBucketRequest.builder().bucket("drshoes-test").build());

        var storage = new S3BlobStorage(client, presigner, "drshoes-test");
        var key = new BlobKey("orders/2026/05/abc.txt");
        storage.put(key, new ByteArrayInputStream("hello".getBytes()),
                new BlobMetadata("text/plain", 5L));

        assertThat(storage.exists(key)).isTrue();

        var presigned = storage.presignGet(key, Duration.ofMinutes(1));
        assertThat(presigned.url()).contains("orders/2026/05/abc.txt");
        assertThat(presigned.expiresAt()).isAfter(java.time.Instant.now());
    }

    @Test
    void exists_returns_false_for_missing_key() throws Exception {
        var client = S3Client.builder()
                .endpointOverride(URI.create(minio.getS3URL()))
                .region(Region.US_EAST_1)
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create("test", "test1234")))
                .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true).build())
                .build();
        var presigner = S3Presigner.builder()
                .endpointOverride(URI.create(minio.getS3URL()))
                .region(Region.US_EAST_1)
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create("test", "test1234")))
                .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true).build())
                .build();
        try {
            client.createBucket(CreateBucketRequest.builder().bucket("drshoes-test").build());
        } catch (software.amazon.awssdk.services.s3.model.BucketAlreadyOwnedByYouException e) {
            // OK — bucket survives across tests
        }

        var storage = new S3BlobStorage(client, presigner, "drshoes-test");
        assertThat(storage.exists(new BlobKey("does/not/exist.txt"))).isFalse();
    }
}
