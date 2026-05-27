package com.drshoes.app.photo.domain;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcType;
import org.hibernate.dialect.PostgreSQLEnumJdbcType;
import org.springframework.data.domain.Persistable;

import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

/**
 * JPA entity for the photo table (created by V009).
 *
 * Implements {@link Persistable} so that Spring Data JPA always calls
 * {@code EntityManager.persist()} rather than {@code merge()} when {@code save()} is
 * invoked with a pre-assigned UUID (as PhotoService does to pre-compute the S3 key
 * before storing the row). Without {@code Persistable}, Spring Data's {@code isNew()}
 * check sees a non-null id and calls {@code merge()}, which expects an existing row
 * and throws {@code StaleObjectStateException}.
 *
 * The {@code @Transient isNew} flag is set to {@code true} at construction time and
 * cleared by {@code @PostPersist} / {@code @PostLoad} so that subsequent saves
 * (e.g. relabel) correctly call {@code merge()}.
 */
@Entity
@Table(name = "photo")
@Getter
@Setter
public class Photo implements Persistable<UUID> {

    @Id
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Transient
    private boolean isNew = true;

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

    @PostPersist
    @PostLoad
    void markNotNew() {
        this.isNew = false;
    }

    @Override
    public UUID getId() {
        return id;
    }

    @Override
    public boolean isNew() {
        return isNew;
    }
}
