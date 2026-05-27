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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import lombok.RequiredArgsConstructor;
@Service
@Slf4j
@RequiredArgsConstructor
public class PhotoService {

    static final Set<String> ALLOWED_MIMES = Set.of(
        "image/jpeg", "image/png", "image/webp", "image/heic"
    );
    static final long MAX_BYTES = 20L * 1024 * 1024;

    private final PhotoRepository photos;
    private final OrderRepository orders;
    private final OrderItemRepository orderItems;
    private final BlobStorage storage;
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
    @Transactional(readOnly = true)
    public List<Photo> listForOrder(UUID orderId) {
        return photos.findByOrderIdOrderByUploadedAtDesc(orderId);
    }
    public StreamHandle stream(UUID orderId, UUID photoId) {
        var photo = photos.findById(photoId)
            .orElseThrow(() -> new PhotoNotFoundException(photoId));
        verifyOwnership(orderId, photoId, photo);
        InputStream bytes = storage.get(new BlobKey(photo.getS3Key()));
        return new StreamHandle(bytes, photo.getMime(), photo.getOriginalFilename());
    }
    @Audited(parent = "#result.orderId")
    @Transactional
    public Photo relabel(UUID orderId, UUID photoId, PhotoLabel newLabel, UUID actorId) {
        var photo = photos.findById(photoId)
            .orElseThrow(() -> new PhotoNotFoundException(photoId));
        verifyOwnership(orderId, photoId, photo);
        var oldLabel = photo.getLabel();
        photo.setLabel(newLabel);
        var saved = photos.save(photo);
        log.info("op=photo.relabel outcome=success photoId={} orderId={} actorId={} oldLabel={} newLabel={}",
            saved.getId(), saved.getOrderId(), actorId, oldLabel, newLabel);
        return saved;
    }
    @Audited(parent = "#result")
    @Transactional
    public UUID delete(UUID orderId, UUID photoId, UUID actorId) {
        var photo = photos.findById(photoId)
            .orElseThrow(() -> new PhotoNotFoundException(photoId));
        verifyOwnership(orderId, photoId, photo);
        var s3Key = photo.getS3Key();
        photos.delete(photo);
        photos.flush();
        try {
            storage.delete(new BlobKey(s3Key));
        } catch (RuntimeException e) {
            log.warn("op=photo.delete outcome=storage_orphan_failed photoId={} s3Key={} actorId={}",
                photoId, s3Key, actorId, e);
        }
        log.info("op=photo.delete outcome=success photoId={} orderId={} actorId={} s3Key={}",
            photoId, orderId, actorId, s3Key);
        return orderId;
    }
    private void verifyOwnership(UUID orderId, UUID photoId, Photo photo) {
        if (!photo.getOrderId().equals(orderId)) {
            throw new PhotoNotFoundException(photoId);
        }
    }

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
    private String buildKey(UUID orderId, UUID photoId, String originalFilename) {
        return "orders/" + orderId + "/" + photoId + "-" + slug(originalFilename);
    }

    private String safeFilename(String original) {
        return (original == null || original.isBlank()) ? "unknown.bin" : original;
    }
    private String slug(String input) {
        if (input == null || input.isBlank()) return "file";
        return input.replaceAll("[^A-Za-z0-9._-]", "_");
    }
    public record StreamHandle(InputStream inputStream, String mime, String filename) {}
}
