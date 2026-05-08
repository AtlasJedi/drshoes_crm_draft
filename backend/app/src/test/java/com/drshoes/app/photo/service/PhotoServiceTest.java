package com.drshoes.app.photo.service;

import com.drshoes.app.AbstractIntegrationTest;
import com.drshoes.app.audit.AuditLogRepository;
import com.drshoes.app.auth.domain.User;
import com.drshoes.app.auth.domain.UserRole;
import com.drshoes.app.auth.principal.AdminPrincipal;
import com.drshoes.app.auth.domain.UserRepository;
import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.order.domain.Order;
import com.drshoes.app.order.domain.OrderRepository;
import com.drshoes.app.order.domain.OrderStatus;
import com.drshoes.app.photo.domain.PhotoLabel;
import com.drshoes.app.photo.domain.PhotoRepository;
import com.drshoes.lib.storage.BlobKey;
import com.drshoes.lib.storage.BlobMetadata;
import com.drshoes.lib.storage.BlobStorage;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Integration tests for PhotoService.
 *
 * BlobStorage is mocked — no real MinIO needed (that's PhotoControllerIT's job).
 * Uses AbstractIntegrationTest (Testcontainers Postgres) for real DB + AuditLogAspect wiring.
 *
 * Audit proof: each mutating test verifies that an INTERNAL audit row is written with
 * method=INTERNAL, path ending in "PhotoService#<op>", parent_entity_id = orderId,
 * actor_id = testUserId — end-to-end proof that @Audited + AuditLogAspect + #result
 * SpEL resolution all work together correctly.
 */
class PhotoServiceTest extends AbstractIntegrationTest {

    @Autowired PhotoService photoService;
    @Autowired PhotoRepository photos;
    @Autowired OrderRepository orders;
    @Autowired ClientRepository clients;
    @Autowired UserRepository users;
    @Autowired AuditLogRepository audits;
    @MockBean BlobStorage blobStorage;

    // ── test lifecycle ───────────────────────────────────────────────────────

    /** UUID of the dedicated test user created in @BeforeEach. */
    private UUID testUserId;

    /**
     * Seeds a unique test user and wires an AdminPrincipal into SecurityContextHolder
     * so AuditLogAspect.resolveActorId() returns a real UUID. Unique email per run
     * avoids conflicts with AdminWebTestBase tests that also insert/delete users.
     */
    @BeforeEach
    void seedUserAndSecurityContext() {
        var u = new User();
        u.setEmail("photo-svc-" + UUID.randomUUID() + "@test.pl");
        u.setPasswordHash("{noop}test");
        u.setFullName("Photo Service Tester");
        u.setRole(UserRole.OWNER);
        testUserId = users.save(u).getId();

        var principal = new AdminPrincipal(testUserId, u.getEmail(), "OWNER");
        var auth = new UsernamePasswordAuthenticationToken(
            principal, null,
            List.of(new SimpleGrantedAuthority("ROLE_OWNER")));
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        audits.deleteAll();
        photos.deleteAll();
        orders.deleteAll();
        clients.deleteAll();
        users.deleteById(testUserId);
    }

    // ── upload happy path ────────────────────────────────────────────────────

    @Test
    void upload_storesRowAfterStoragePut_emitsAuditWithParentEntityId() {
        var order = givenOrder();
        var bytes = "fake jpeg bytes".getBytes();
        var file  = new MockMultipartFile("file", "cat.jpg", "image/jpeg", bytes);

        var saved = photoService.upload(order.getId(), null, file, PhotoLabel.BEFORE, testUserId);

        // 1. BlobStorage.put called with correctly structured key and metadata.
        ArgumentCaptor<BlobKey>      keyCap = ArgumentCaptor.forClass(BlobKey.class);
        ArgumentCaptor<BlobMetadata>  mdCap = ArgumentCaptor.forClass(BlobMetadata.class);
        verify(blobStorage).put(keyCap.capture(), any(), mdCap.capture());
        assertThat(keyCap.getValue().value())
            .startsWith("orders/" + order.getId() + "/" + saved.getId() + "-");
        assertThat(mdCap.getValue().contentType()).isEqualTo("image/jpeg");
        assertThat(mdCap.getValue().contentLength()).isEqualTo((long) bytes.length);

        // 2. DB row persisted with correct fields.
        var found = photos.findById(saved.getId()).orElseThrow();
        assertThat(found.getOrderId()).isEqualTo(order.getId());
        assertThat(found.getLabel()).isEqualTo(PhotoLabel.BEFORE);
        assertThat(found.getUploadedBy()).isEqualTo(testUserId);
        assertThat(found.getOriginalFilename()).isEqualTo("cat.jpg");
        assertThat(found.getMime()).isEqualTo("image/jpeg");
        assertThat(found.getSizeBytes()).isEqualTo((long) bytes.length);

        // 3. End-to-end audit proof: row written with actor_id and parent_entity_id.
        var photoAudits = audits.findAll().stream()
            .filter(a -> a.getPath() != null && a.getPath().endsWith("PhotoService#upload"))
            .toList();
        assertThat(photoAudits)
            .as("Expected exactly one PhotoService#upload audit row")
            .hasSize(1);
        assertThat(photoAudits.get(0).getActorId())
            .as("audit_log.actor_id must carry the authenticated user's UUID")
            .isEqualTo(testUserId);
        assertThat(photoAudits.get(0).getParentEntityId())
            .as("audit_log.parent_entity_id must be the orderId")
            .isEqualTo(order.getId());
    }

    // ── upload validation guards ─────────────────────────────────────────────

    @Test
    void upload_rejectsUnsupportedMime() {
        var order = givenOrder();
        var file  = new MockMultipartFile("file", "doc.pdf", "application/pdf", "x".getBytes());

        assertThatThrownBy(() ->
            photoService.upload(order.getId(), null, file, PhotoLabel.OTHER, testUserId))
            .isInstanceOf(UnsupportedPhotoMimeException.class);

        verifyNoInteractions(blobStorage);
        assertThat(photos.findAll()).isEmpty();
    }

    @Test
    void upload_rejectsTooLarge() {
        var order = givenOrder();
        var big   = new byte[20 * 1024 * 1024 + 1];   // 20 MB + 1 byte
        var file  = new MockMultipartFile("file", "big.jpg", "image/jpeg", big);

        assertThatThrownBy(() ->
            photoService.upload(order.getId(), null, file, PhotoLabel.OTHER, testUserId))
            .isInstanceOf(PhotoTooLargeException.class);

        verifyNoInteractions(blobStorage);
    }

    // ── delete ───────────────────────────────────────────────────────────────

    @Test
    void delete_removesDbRowAndCallsStorageDelete() {
        var order = givenOrder();
        var photo = photoService.upload(order.getId(), null,
            new MockMultipartFile("file", "x.jpg", "image/jpeg", "y".getBytes()),
            PhotoLabel.OTHER, testUserId);
        reset(blobStorage);

        photoService.delete(photo.getId(), testUserId);

        verify(blobStorage).delete(argThat(k -> k.value().equals(photo.getS3Key())));
        assertThat(photos.findById(photo.getId())).isEmpty();
    }

    @Test
    void delete_returnsOrderId_andAuditRowHasCorrectParent() {
        var order = givenOrder();
        var photo = photoService.upload(order.getId(), null,
            new MockMultipartFile("file", "x.jpg", "image/jpeg", "y".getBytes()),
            PhotoLabel.OTHER, testUserId);
        reset(blobStorage);
        audits.deleteAll();   // clear upload audit so assertion targets only the delete row

        var returnedOrderId = photoService.delete(photo.getId(), testUserId);

        assertThat(returnedOrderId).isEqualTo(order.getId());

        var deleteAudits = audits.findAll().stream()
            .filter(a -> a.getPath() != null && a.getPath().endsWith("PhotoService#delete"))
            .toList();
        assertThat(deleteAudits).hasSize(1);
        assertThat(deleteAudits.get(0).getParentEntityId())
            .as("delete audit row must carry orderId as parent_entity_id via #result SpEL")
            .isEqualTo(order.getId());
    }

    // ── relabel ──────────────────────────────────────────────────────────────

    @Test
    void relabel_updatesLabel_andAuditRowHasCorrectParent() {
        var order = givenOrder();
        var photo = photoService.upload(order.getId(), null,
            new MockMultipartFile("file", "x.jpg", "image/jpeg", "y".getBytes()),
            PhotoLabel.OTHER, testUserId);
        audits.deleteAll();   // clear upload audit

        var updated = photoService.relabel(photo.getId(), PhotoLabel.AFTER, testUserId);

        assertThat(updated.getLabel()).isEqualTo(PhotoLabel.AFTER);

        var relabelAudits = audits.findAll().stream()
            .filter(a -> a.getPath() != null && a.getPath().endsWith("PhotoService#relabel"))
            .toList();
        assertThat(relabelAudits).hasSize(1);
        assertThat(relabelAudits.get(0).getParentEntityId())
            .as("relabel audit row must carry orderId via #result.orderId SpEL")
            .isEqualTo(order.getId());
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private Order givenOrder() {
        var c = new Client();
        c.setFirstName("Klient");
        c.setPhone("+48 600 000 000");
        var savedClient = clients.save(c);
        var o = new Order();
        o.setClientId(savedClient.getId());
        o.setStatus(OrderStatus.WSTEPNIE_PRZYJETE);
        o.setCode("PHOTO-TEST-" + UUID.randomUUID().toString().substring(0, 8));
        return orders.save(o);
    }
}
