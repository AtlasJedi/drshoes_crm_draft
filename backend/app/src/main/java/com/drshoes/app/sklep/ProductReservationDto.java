package com.drshoes.app.sklep;

import java.time.Instant;
import java.util.UUID;
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
