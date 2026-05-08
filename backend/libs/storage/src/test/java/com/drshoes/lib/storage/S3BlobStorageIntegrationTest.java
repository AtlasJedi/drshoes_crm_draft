package com.drshoes.lib.storage;

import org.junit.jupiter.api.BeforeAll;
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
import java.io.InputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@Testcontainers
class S3BlobStorageIntegrationTest {

    @Container
    static MinIOContainer minio = new MinIOContainer("minio/minio:RELEASE.2024-10-13T13-34-11Z")
            .withUserName("test").withPassword("test1234");

    static S3BlobStorage storage;

    @BeforeAll
    static void setUp() {
        var creds = StaticCredentialsProvider.create(
                AwsBasicCredentials.create("test", "test1234"));
        var s3Config = S3Configuration.builder().pathStyleAccessEnabled(true).build();
        var endpoint = URI.create(minio.getS3URL());

        var client = S3Client.builder()
                .endpointOverride(endpoint)
                .region(Region.US_EAST_1)
                .credentialsProvider(creds)
                .serviceConfiguration(s3Config)
                .build();
        var presigner = S3Presigner.builder()
                .endpointOverride(endpoint)
                .region(Region.US_EAST_1)
                .credentialsProvider(creds)
                .serviceConfiguration(s3Config)
                .build();

        try {
            client.createBucket(CreateBucketRequest.builder().bucket("drshoes-test").build());
        } catch (software.amazon.awssdk.services.s3.model.BucketAlreadyOwnedByYouException e) {
            // bucket survives across tests — OK
        }

        storage = new S3BlobStorage(client, presigner, "drshoes-test");
    }

    @Test
    void put_then_exists_then_presign_get() throws Exception {
        var key = new BlobKey("orders/2026/05/abc.txt");
        storage.put(key, new ByteArrayInputStream("hello".getBytes()),
                new BlobMetadata("text/plain", 5L));

        assertThat(storage.exists(key)).isTrue();

        var presigned = storage.presignGet(key, Duration.ofMinutes(1));
        assertThat(presigned.url()).contains("orders/2026/05/abc.txt");
        assertThat(presigned.expiresAt()).isAfter(java.time.Instant.now());
    }

    @Test
    void exists_returns_false_for_missing_key() {
        assertThat(storage.exists(new BlobKey("does/not/exist.txt"))).isFalse();
    }

    @Test
    void get_streamsBackTheBytesWeWrote() throws Exception {
        var key   = new BlobKey("orders/test-get/" + UUID.randomUUID() + "-cat.jpg");
        var bytes = "fake jpeg bytes".getBytes(StandardCharsets.UTF_8);

        storage.put(key, new ByteArrayInputStream(bytes),
                new BlobMetadata("image/jpeg", (long) bytes.length));

        try (InputStream got = storage.get(key)) {
            byte[] roundTripped = got.readAllBytes();
            assertThat(roundTripped).isEqualTo(bytes);
        }
    }

    @Test
    void get_throwsWhenMissing() {
        var key = new BlobKey("does/not/exist-" + UUID.randomUUID());
        assertThatThrownBy(() -> storage.get(key).close())
            .isInstanceOf(software.amazon.awssdk.services.s3.model.NoSuchKeyException.class);
    }
}
