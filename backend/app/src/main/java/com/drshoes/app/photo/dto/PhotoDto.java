package com.drshoes.app.photo.dto;

import com.drshoes.app.photo.domain.Photo;
import com.drshoes.app.photo.domain.PhotoLabel;

import java.time.Instant;
import java.util.UUID;

/**
 * Wire representation of a Photo returned by PhotoController endpoints.
 * Never exposes the JPA entity directly; fileUrl is a stable proxy path.
 */
public record PhotoDto(
    UUID id,
    UUID orderId,
    UUID orderItemId,
    UUID uploadedBy,
    Instant uploadedAt,
    String mime,
    long sizeBytes,
    PhotoLabel label,
    String originalFilename,
    String fileUrl            // /api/admin/photos/{id}/file — proxy endpoint
) {
    /** Build from a Photo entity. fileUrl is deterministic from the photo id. */
    public static PhotoDto from(Photo p) {
        return new PhotoDto(
            p.getId(),
            p.getOrderId(),
            p.getOrderItemId(),
            p.getUploadedBy(),
            p.getUploadedAt(),
            p.getMime(),
            p.getSizeBytes(),
            p.getLabel(),
            p.getOriginalFilename(),
            "/api/admin/photos/" + p.getId() + "/file"
        );
    }
}
