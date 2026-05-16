package com.drshoes.app.order.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

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

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getOrderId() { return orderId; }
    public void setOrderId(UUID orderId) { this.orderId = orderId; }

    public int getPosition() { return position; }
    public void setPosition(int position) { this.position = position; }

    public OrderItemKind getKind() { return kind; }
    public void setKind(OrderItemKind kind) { this.kind = kind; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getCraftsmanNotes() { return craftsmanNotes; }
    public void setCraftsmanNotes(String craftsmanNotes) { this.craftsmanNotes = craftsmanNotes; }

    public int getPriceCents() { return priceCents; }
    public void setPriceCents(int priceCents) { this.priceCents = priceCents; }

    public Instant getCreatedAt() { return createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
}
