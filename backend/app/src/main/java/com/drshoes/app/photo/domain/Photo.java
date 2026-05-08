package com.drshoes.app.photo.domain;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcType;
import org.hibernate.dialect.PostgreSQLEnumJdbcType;

import java.time.Instant;
import java.util.UUID;

/**
 * JPA entity for the photo table (created by V009).
 * This stub ships in task 3-1 to satisfy compilation of the @Disabled PhotoRepositoryTest
 * and to prove V009 + Hibernate schema validation are consistent.
 * Task 3-5 completes the entity with full service/controller wiring.
 */
@Entity
@Table(name = "photo")
public class Photo {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "order_id", nullable = false, columnDefinition = "uuid")
    private UUID orderId;

    @Column(name = "order_item_id", columnDefinition = "uuid")
    private UUID orderItemId;

    @Column(name = "uploaded_by", nullable = false, columnDefinition = "uuid")
    private UUID uploadedBy;

    @Column(name = "uploaded_at", nullable = false)
    private Instant uploadedAt = Instant.now();

    @Column(name = "s3_key", nullable = false, unique = true, columnDefinition = "text")
    private String s3Key;

    @Column(name = "mime", nullable = false, columnDefinition = "text")
    private String mime;

    @Column(name = "size_bytes", nullable = false)
    private long sizeBytes;

    @Enumerated(EnumType.STRING)
    @JdbcType(PostgreSQLEnumJdbcType.class)
    @Column(name = "label", nullable = false, columnDefinition = "photo_label")
    private PhotoLabel label = PhotoLabel.OTHER;

    @Column(name = "original_filename", nullable = false, columnDefinition = "text")
    private String originalFilename;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getOrderId() { return orderId; }
    public void setOrderId(UUID orderId) { this.orderId = orderId; }

    public UUID getOrderItemId() { return orderItemId; }
    public void setOrderItemId(UUID orderItemId) { this.orderItemId = orderItemId; }

    public UUID getUploadedBy() { return uploadedBy; }
    public void setUploadedBy(UUID uploadedBy) { this.uploadedBy = uploadedBy; }

    public Instant getUploadedAt() { return uploadedAt; }
    public void setUploadedAt(Instant uploadedAt) { this.uploadedAt = uploadedAt; }

    public String getS3Key() { return s3Key; }
    public void setS3Key(String s3Key) { this.s3Key = s3Key; }

    public String getMime() { return mime; }
    public void setMime(String mime) { this.mime = mime; }

    public long getSizeBytes() { return sizeBytes; }
    public void setSizeBytes(long sizeBytes) { this.sizeBytes = sizeBytes; }

    public PhotoLabel getLabel() { return label; }
    public void setLabel(PhotoLabel label) { this.label = label; }

    public String getOriginalFilename() { return originalFilename; }
    public void setOriginalFilename(String originalFilename) { this.originalFilename = originalFilename; }
}
