package com.drshoes.app.order.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

/**
 * JPA entity for the order_item table.
 *
 * Design notes:
 *   - orderId is a raw UUID FK — no @ManyToOne (aggregate boundary kept).
 *   - No @Version — optimistic locking is on Order (aggregate root) only.
 *   - Items are fetched independently via OrderItemRepository.findAllByOrderIdOrderByPosition.
 */
@Entity
@Table(name = "order_item")
@Getter
@Setter
public class OrderItem {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "order_id", nullable = false, columnDefinition = "uuid")
    private UUID orderId;

    @Column(name = "position", nullable = false)
    private int position = 0;

    @Enumerated(EnumType.STRING)
    @Column(name = "kind", nullable = false, length = 20)
    private OrderItemKind kind;

    @Column(name = "description", columnDefinition = "text")
    private String description;

    @Column(name = "craftsman_notes", columnDefinition = "text")
    private String craftsmanNotes;

    @Column(name = "price_cents", nullable = false)
    private int priceCents = 0;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @PreUpdate
    void onUpdate() { this.updatedAt = Instant.now(); }

    // ---- accessors ----
    public void setOrderId(UUID orderId) { this.orderId = orderId; }
    public void setKind(OrderItemKind kind) { this.kind = kind; }
    public void setCraftsmanNotes(String craftsmanNotes) { this.craftsmanNotes = craftsmanNotes; }

}
