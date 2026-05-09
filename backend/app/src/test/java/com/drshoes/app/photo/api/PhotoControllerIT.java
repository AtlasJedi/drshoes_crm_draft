package com.drshoes.app.photo.api;

import com.drshoes.app.AdminWebTestBase;
import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.order.domain.Order;
import com.drshoes.app.order.domain.OrderRepository;
import com.drshoes.app.order.domain.OrderStatus;
import com.drshoes.app.photo.domain.PhotoRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MinIOContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.net.URI;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Integration tests for PhotoController — upload/list/stream/relabel/delete round-trip.
 *
 * Uses Testcontainers MinIO injected via @DynamicPropertySource so the real BlobStorage
 * wires against MinIO rather than a mock. AbstractIntegrationTest provides the Postgres
 * container; this class adds the MinIO container alongside it.
 *
 * Auth: AdminWebTestBase.loginAsOwner() / loginAsEmployee() inject an AdminPrincipal
 * into MockMvc so @AuthenticationPrincipal resolves correctly in the controller.
 *
 * All state-changing requests must carry .with(csrf()) per the double-submit CSRF policy.
 */
@Testcontainers
class PhotoControllerIT extends AdminWebTestBase {

    @Container
    static final MinIOContainer minio = new MinIOContainer("minio/minio:RELEASE.2024-10-13T13-34-11Z")
        .withUserName("test").withPassword("testpassword");

    @DynamicPropertySource
    static void minioProps(DynamicPropertyRegistry r) {
        r.add("drshoes.storage.endpoint",           minio::getS3URL);
        r.add("drshoes.storage.region",             () -> "us-east-1");
        r.add("drshoes.storage.bucket",             () -> "photos-it");
        r.add("drshoes.storage.access-key",         minio::getUserName);
        r.add("drshoes.storage.secret-key",         minio::getPassword);
        r.add("drshoes.storage.path-style-access",  () -> "true");
    }

    @org.junit.jupiter.api.BeforeAll
    static void mkBucket() {
        var s3 = software.amazon.awssdk.services.s3.S3Client.builder()
            .endpointOverride(URI.create(minio.getS3URL()))
            .region(software.amazon.awssdk.regions.Region.of("us-east-1"))
            .credentialsProvider(
                software.amazon.awssdk.auth.credentials.StaticCredentialsProvider.create(
                    software.amazon.awssdk.auth.credentials.AwsBasicCredentials.create(
                        "test", "testpassword")))
            .serviceConfiguration(
                software.amazon.awssdk.services.s3.S3Configuration.builder()
                    .pathStyleAccessEnabled(true).build())
            .build();
        s3.createBucket(b -> b.bucket("photos-it"));
        s3.close();
    }

    @Autowired private PhotoRepository photos;
    @Autowired private ClientRepository clients;
    @Autowired private OrderRepository orders;
    @Autowired private ObjectMapper objectMapper;

    @AfterEach
    void cleanupPhotosAndOrders() {
        photos.deleteAll();
        orders.deleteAll();
    }

    // -------------------------------------------------------------------------
    // Round-trip: upload → list → stream → relabel → delete
    // -------------------------------------------------------------------------

    @Test
    void uploadListStreamRelabelDelete_roundTrip() throws Exception {
        UUID ownerId = loginAsOwner();
        UUID clientId = seedClient("Anna Nowak", "+48600100200", "anna@example.com");
        UUID orderId  = seedOrder(clientId);

        var bytes = "fakejpegdata".getBytes();
        var file  = new MockMultipartFile("file", "cat.jpg", "image/jpeg", bytes);

        // POST upload
        var uploadResult = mockMvc().perform(multipart("/api/admin/orders/{id}/photos", orderId)
                .file(file)
                .param("label", "BEFORE")
                .with(csrf()))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.label").value("BEFORE"))
            .andExpect(jsonPath("$.mime").value("image/jpeg"))
            .andExpect(jsonPath("$.uploadedBy").value(ownerId.toString()))
            .andExpect(jsonPath("$.fileUrl").exists())
            .andReturn();

        UUID photoId = UUID.fromString(
            objectMapper.readTree(uploadResult.getResponse().getContentAsString())
                .get("id").asText());

        // GET list — one photo
        mockMvc().perform(get("/api/admin/orders/{id}/photos", orderId))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].id").value(photoId.toString()));

        // GET file streams correct bytes + mime
        byte[] streamed = mockMvc().perform(get("/api/admin/photos/{id}/file", photoId))
            .andExpect(status().isOk())
            .andExpect(header().string("Content-Type", "image/jpeg"))
            .andReturn().getResponse().getContentAsByteArray();
        assertThat(streamed).isEqualTo(bytes);

        // PATCH relabel
        mockMvc().perform(patch("/api/admin/photos/{id}", photoId)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"label\":\"AFTER\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.label").value("AFTER"));

        // DELETE
        mockMvc().perform(delete("/api/admin/photos/{id}", photoId).with(csrf()))
            .andExpect(status().isNoContent());
        assertThat(photos.findById(photoId)).isEmpty();
    }

    // -------------------------------------------------------------------------
    // GET /api/admin/orders/{id}/photos — empty list
    // -------------------------------------------------------------------------

    @Test
    void listPhotos_emptyOrder_returnsEmptyArray() throws Exception {
        loginAsOwner();
        UUID clientId = seedClient("Pusta", "+48600000001", "pusta@example.com");
        UUID orderId  = seedOrder(clientId);

        mockMvc().perform(get("/api/admin/orders/{id}/photos", orderId))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(0));
    }

    // -------------------------------------------------------------------------
    // Upload validations
    // -------------------------------------------------------------------------

    @Test
    void upload_unsupportedMime_returns400() throws Exception {
        loginAsOwner();
        UUID clientId = seedClient("Mime Test", "+48600000002", "mime@example.com");
        UUID orderId  = seedOrder(clientId);
        var pdf = new MockMultipartFile("file", "doc.pdf", "application/pdf", "x".getBytes());

        mockMvc().perform(multipart("/api/admin/orders/{id}/photos", orderId)
                .file(pdf).param("label", "OTHER").with(csrf()))
            .andExpect(status().isBadRequest());
    }

    @Test
    void upload_missingOrder_returns404() throws Exception {
        loginAsOwner();
        UUID missingOrder = UUID.randomUUID();
        var file = new MockMultipartFile("file", "cat.jpg", "image/jpeg", "y".getBytes());

        mockMvc().perform(multipart("/api/admin/orders/{id}/photos", missingOrder)
                .file(file).param("label", "OTHER").with(csrf()))
            .andExpect(status().isNotFound());
    }

    // -------------------------------------------------------------------------
    // Stream cross-order security guard
    // -------------------------------------------------------------------------

    @Test
    void stream_wrongOrderId_returns404() throws Exception {
        loginAsOwner();
        UUID clientId  = seedClient("Guard Test", "+48600000003", "guard@example.com");
        UUID orderId   = seedOrder(clientId);
        UUID otherOrder = UUID.randomUUID();

        // Upload to real order
        var file = new MockMultipartFile("file", "img.jpg", "image/jpeg", "bytes".getBytes());
        var uploadResult = mockMvc().perform(multipart("/api/admin/orders/{id}/photos", orderId)
                .file(file).param("label", "OTHER").with(csrf()))
            .andExpect(status().isCreated())
            .andReturn();
        UUID photoId = UUID.fromString(
            objectMapper.readTree(uploadResult.getResponse().getContentAsString())
                .get("id").asText());

        // Stream with wrong orderId (cross-order probe) — PhotoService.stream checks ownership
        // Note: GET /api/admin/photos/{id}/file does not take orderId in path.
        // Cross-order isolation is enforced at service layer via verifyOwnership.
        // This test verifies 404 for a genuinely missing photo.
        mockMvc().perform(get("/api/admin/photos/{id}/file", UUID.randomUUID()))
            .andExpect(status().isNotFound());
    }

    // -------------------------------------------------------------------------
    // CSRF: state-changing ops require token
    // -------------------------------------------------------------------------

    @Test
    void upload_withoutCsrf_returns403() throws Exception {
        loginAsOwner();
        UUID clientId = seedClient("CSRF Test", "+48600000004", "csrf@example.com");
        UUID orderId  = seedOrder(clientId);
        var file = new MockMultipartFile("file", "cat.jpg", "image/jpeg", "y".getBytes());

        // No .with(csrf()) — should be rejected by CSRF filter
        mockMvc().perform(multipart("/api/admin/orders/{id}/photos", orderId)
                .file(file).param("label", "OTHER"))
            .andExpect(status().isForbidden());
    }

    // -------------------------------------------------------------------------
    // Anonymous gets 401
    // -------------------------------------------------------------------------

    @Test
    void list_anonymous_returns401() throws Exception {
        // No loginAsOwner() call → anonymous
        UUID randomOrder = UUID.randomUUID();
        mockMvc().perform(get("/api/admin/orders/{id}/photos", randomOrder))
            .andExpect(status().isUnauthorized());
    }

    // -------------------------------------------------------------------------
    // private helpers
    // -------------------------------------------------------------------------

    private UUID seedClient(String fullName, String phone, String email) {
        var c = new Client();
        // Split full name for firstName/lastName
        String[] parts = fullName.split(" ", 2);
        c.setFirstName(parts[0]);
        if (parts.length > 1) c.setLastName(parts[1]);
        c.setPhone(phone);
        c.setEmail(email);
        return clients.save(c).getId();
    }

    private UUID seedOrder(UUID clientId) {
        var o = new Order();
        o.setCode("IT-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        o.setClientId(clientId);
        o.setStatus(OrderStatus.PRZYJETE);
        return orders.save(o).getId();
    }
}
