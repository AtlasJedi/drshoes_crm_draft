package com.drshoes.app.photo.service;

import com.drshoes.app.audit.Audited;
import com.drshoes.app.order.domain.OrderItemRepository;
import com.drshoes.app.order.domain.OrderRepository;
import com.drshoes.app.order.OrderNotFoundException;
import com.drshoes.app.photo.domain.Photo;
import com.drshoes.app.photo.domain.PhotoLabel;
import com.drshoes.app.photo.domain.PhotoRepository;
import com.drshoes.lib.storage.BlobKey;
import com.drshoes.lib.storage.BlobMetadata;
import com.drshoes.lib.storage.BlobStorage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Service layer for the admin photo gallery.
 *
 * <h2>Storage ordering</h2>
 * Upload: BlobStorage.put THEN photos.save. If the DB write fails the transaction
 * rolls back; a storage orphan may remain but the row never exists — no partial state
 * visible to readers. Acceptable per "simplest-but-working" project rule.
 *
 * Delete: photos.delete THEN BlobStorage.delete. DB-first so the row is gone before
 * the object. If the storage delete fails we log a WARN (orphan_failed) and continue —
 * not user-visible; no retry infrastructure yet.
 *
 * <h2>Audit</h2>
 * Each mutating method carries @Audited(parent=...) so AuditLogAspect writes an
 * INTERNAL audit row with parent_entity_id = orderId — linking the event to the order
 * timeline without any manual audit writes in this service.
 *
 * Structured logging: op=photo.* actor={} orderId={} photoId={} outcome={}
 */
@Service
public class PhotoService {

    private static final Logger log = LoggerFactory.getLogger(PhotoService.class);

    static final Set<String> ALLOWED_MIMES = Set.of(
        "image/jpeg", "image/png", "image/webp", "image/heic"
    );
    static final long MAX_BYTES = 20L * 1024 * 1024;   // 20 MB

    private final PhotoRepository photos;
    private final OrderRepository orders;
    private final OrderItemRepository orderItems;
    private final BlobStorage storage;

    public PhotoService(PhotoRepository photos, OrderRepository orders,
                        OrderItemRepository orderItems, BlobStorage storage) {
        this.photos = photos;
        this.orders = orders;
        this.orderItems = orderItems;
        this.storage = storage;
    }

    /**
     * Upload a new photo for an order. Validates mime type and size, stores bytes,
     * then persists the row.
     *
     * @param orderId  the parent order (must exist)
     * @param itemId   optional order-item association (null = order-level photo)
     * @param file     the multipart upload
     * @param label    initial label (BEFORE/IN_PROGRESS/AFTER/OTHER)
     * @param actorId  the authenticated user performing the upload
     * @return the persisted Photo entity
     */
    @Audited(parent = "#orderId")
    @Transactional
    public Photo upload(UUID orderId, UUID itemId, MultipartFile file,
                        PhotoLabel label, UUID actorId) {
        validateOrderExists(orderId);
        validateItemBelongsToOrder(orderId, itemId);
        validateMime(file.getContentType());
        validateSize(file.getSize());

        var photoId = UUID.randomUUID();
        var key = new BlobKey(buildKey(orderId, photoId, file.getOriginalFilename()));

        try (InputStream in = file.getInputStream()) {
            storage.put(key, in, new BlobMetadata(file.getContentType(), file.getSize()));
        } catch (IOException e) {
            log.warn("op=photo.upload outcome=storage_failed orderId={} actorId={} mime={} size={}",
                orderId, actorId, file.getContentType(), file.getSize(), e);
            throw new RuntimeException("photo upload to storage failed", e);
        }

        var photo = new Photo();
        photo.setId(photoId);
        photo.setOrderId(orderId);
        photo.setOrderItemId(itemId);
        photo.setUploadedBy(actorId);
        photo.setS3Key(key.value());
        photo.setMime(file.getContentType());
        photo.setSizeBytes(file.getSize());
        photo.setLabel(label != null ? label : PhotoLabel.OTHER);
        photo.setOriginalFilename(safeFilename(file.getOriginalFilename()));
        var saved = photos.save(photo);

        log.info("op=photo.upload outcome=success photoId={} orderId={} actorId={} sizeBytes={} mime={} label={}",
            saved.getId(), orderId, actorId, saved.getSizeBytes(), saved.getMime(), saved.getLabel());
        return saved;
    }

    /**
     * List all photos for an order, newest first.
     */
    @Transactional(readOnly = true)
    public List<Photo> listForOrder(UUID orderId) {
        return photos.findByOrderIdOrderByUploadedAtDesc(orderId);
    }

    /**
     * Stream the bytes of a photo back to the caller.
     * Caller MUST close the returned InputStream (try-with-resources).
     */
    @Transactional(readOnly = true)
    public StreamHandle stream(UUID photoId) {
        var photo = photos.findById(photoId)
            .orElseThrow(() -> new PhotoNotFoundException(photoId));
        InputStream bytes = storage.get(new BlobKey(photo.getS3Key()));
        return new StreamHandle(bytes, photo.getMime(), photo.getOriginalFilename());
    }

    /**
     * Change the label on a photo. Returns the updated entity so @Audited can
     * resolve parent_entity_id via "#result.orderId".
     */
    @Audited(parent = "#result.orderId")
    @Transactional
    public Photo relabel(UUID photoId, PhotoLabel newLabel, UUID actorId) {
        var photo = photos.findById(photoId)
            .orElseThrow(() -> new PhotoNotFoundException(photoId));
        var oldLabel = photo.getLabel();
        photo.setLabel(newLabel);
        var saved = photos.save(photo);
        log.info("op=photo.relabel outcome=success photoId={} orderId={} actorId={} oldLabel={} newLabel={}",
            saved.getId(), saved.getOrderId(), actorId, oldLabel, newLabel);
        return saved;
    }

    /**
     * Hard-delete a photo row and its storage object. Returns the orderId so that
     * @Audited(parent="#result") can link the audit row to the order timeline.
     *
     * Deletion order: DB row first, then storage. Storage failure is logged as
     * orphan_failed and not propagated — the row is already gone so the photo is
     * invisible to all readers. Best-effort cleanup per project simplicity rule.
     *
     * @return the orderId of the deleted photo (used by @Audited SpEL "#result")
     */
    @Audited(parent = "#result")
    @Transactional
    public UUID delete(UUID photoId, UUID actorId) {
        var photo = photos.findById(photoId)
            .orElseThrow(() -> new PhotoNotFoundException(photoId));
        var orderId = photo.getOrderId();
        var s3Key = photo.getS3Key();
        photos.delete(photo);
        photos.flush();   // flush DB delete before attempting storage delete
        try {
            storage.delete(new BlobKey(s3Key));
        } catch (RuntimeException e) {
            log.warn("op=photo.delete outcome=storage_orphan_failed photoId={} s3Key={} actorId={}",
                photoId, s3Key, actorId, e);
            // DB row gone; orphan blob remains. Not user-visible.
        }
        log.info("op=photo.delete outcome=success photoId={} orderId={} actorId={} s3Key={}",
            photoId, orderId, actorId, s3Key);
        return orderId;
    }

    // ── private helpers ──────────────────────────────────────────────────────

    private void validateOrderExists(UUID orderId) {
        if (!orders.existsById(orderId)) {
            throw new OrderNotFoundException(orderId);
        }
    }

    private void validateItemBelongsToOrder(UUID orderId, UUID itemId) {
        if (itemId == null) return;
        var item = orderItems.findById(itemId)
            .orElseThrow(() -> new OrderItemNotInOrderException(itemId, orderId));
        if (!item.getOrderId().equals(orderId)) {
            throw new OrderItemNotInOrderException(itemId, orderId);
        }
    }

    private void validateMime(String mime) {
        if (mime == null || !ALLOWED_MIMES.contains(mime)) {
            throw new UnsupportedPhotoMimeException(mime);
        }
    }

    private void validateSize(long size) {
        if (size > MAX_BYTES) {
            throw new PhotoTooLargeException(size, MAX_BYTES);
        }
    }

    /**
     * Build the S3 key. Format: orders/{orderId}/{photoId}-{slugifiedFilename}
     * Key always starts with a letter ("o" from "orders/") — satisfies BlobKey constraint.
     */
    private String buildKey(UUID orderId, UUID photoId, String originalFilename) {
        return "orders/" + orderId + "/" + photoId + "-" + slug(originalFilename);
    }

    private String safeFilename(String original) {
        return (original == null || original.isBlank()) ? "unknown.bin" : original;
    }

    /** Slugify: replace anything that is not alphanumeric, dot, dash or underscore. */
    private String slug(String input) {
        if (input == null || input.isBlank()) return "file";
        return input.replaceAll("[^A-Za-z0-9._-]", "_");
    }

    /** Carries an open InputStream plus content-type and filename for HTTP streaming. */
    public record StreamHandle(InputStream inputStream, String mime, String filename) {}
}
