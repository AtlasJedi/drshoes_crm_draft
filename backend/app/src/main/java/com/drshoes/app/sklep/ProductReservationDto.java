package com.drshoes.app.sklep;

import java.time.Instant;
import java.util.UUID;

/**
 * Immutable DTO for the product reservation API response.
 * Maps 1:1 with {@link ProductReservation} fields; no sensitive data exposed.
 */
public record ProductReservationDto(
    UUID    id,
    UUID    productId,
    String  clientName,
    String  clientPhone,
    String  note,
    String  status,
    Instant reservedAt,
    Instant createdAt
) {
    static ProductReservationDto from(ProductReservation r) {
        return new ProductReservationDto(
            r.getId(),
            r.getProductId(),
            r.getClientName(),
            r.getClientPhone(),
            r.getNote(),
            r.getStatus(),
            r.getReservedAt(),
            r.getCreatedAt()
        );
    }
}
