package com.drshoes.app.order.domain;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

/**
 * JPA entity for the order_ table (aggregate root).
 *
 * Design notes:
 *   - clientId / assignedCraftsmanId are raw UUIDs — no @ManyToOne (aggregate boundary).
 *   - Items are NOT modelled as @OneToMany; they are fetched separately via OrderItemRepository.
 *   - @Version enables optimistic locking via the version column added by V004.
 *   - tags is stored as JSONB; mapped as String for simplicity (JSON array serialized by caller).
 */
@Entity
@Table(name = "order_")
public class Order {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "code", nullable = false, unique = true, length = 20)
    private String code;

    @Column(name = "client_id", nullable = false, columnDefinition = "uuid")
    private UUID clientId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private OrderStatus status;

    @Enumerated(EnumType.STRING)
    @Column(name = "source", nullable = false, length = 20)
    private OrderSource source = OrderSource.ADMIN;

    @Column(name = "received_at")
    private Instant receivedAt;

    @Column(name = "planned_pickup_at")
    private Instant plannedPickupAt;

    @Column(name = "picked_up_at")
    private Instant pickedUpAt;

    @Column(name = "assigned_craftsman_id", columnDefinition = "uuid")
    private UUID assignedCraftsmanId;

    @Column(name = "current_storage_location_id", columnDefinition = "uuid")
    private UUID currentStorageLocationId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "tags", nullable = false, columnDefinition = "jsonb")
    private String tags = "[]";

    @Column(name = "total_price_cents", nullable = false)
    private int totalPriceCents = 0;

    @Column(name = "quoted_price_cents", nullable = false)
    private int quotedPriceCents = 0;

    @Column(name = "advance_paid_cents", nullable = false)
    private int advancePaidCents = 0;

    @Column(name = "currency", nullable = false, length = 3)
    private String currency = "PLN";

    @Column(name = "location", length = 64)
    private String location;

    @Column(name = "description", columnDefinition = "text")
    private String description;

    @Column(name = "cancelled_reason", columnDefinition = "text")
    private String cancelledReason;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @Version
    @Column(name = "version", nullable = false)
    private int version;

    @PreUpdate
    void onUpdate() { this.updatedAt = Instant.now(); }

    // ---- accessors ----

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public UUID getClientId() { return clientId; }
    public void setClientId(UUID clientId) { this.clientId = clientId; }

    public OrderStatus getStatus() { return status; }
    public void setStatus(OrderStatus status) { this.status = status; }

    public OrderSource getSource() { return source; }
    public void setSource(OrderSource source) { this.source = source; }

    public Instant getReceivedAt() { return receivedAt; }
    public void setReceivedAt(Instant receivedAt) { this.receivedAt = receivedAt; }

    public Instant getPlannedPickupAt() { return plannedPickupAt; }
    public void setPlannedPickupAt(Instant plannedPickupAt) { this.plannedPickupAt = plannedPickupAt; }

    public Instant getPickedUpAt() { return pickedUpAt; }
    public void setPickedUpAt(Instant pickedUpAt) { this.pickedUpAt = pickedUpAt; }

    public UUID getAssignedCraftsmanId() { return assignedCraftsmanId; }
    public void setAssignedCraftsmanId(UUID assignedCraftsmanId) { this.assignedCraftsmanId = assignedCraftsmanId; }

    public UUID getCurrentStorageLocationId() { return currentStorageLocationId; }
    public void setCurrentStorageLocationId(UUID currentStorageLocationId) { this.currentStorageLocationId = currentStorageLocationId; }

    public String getTags() { return tags; }
    public void setTags(String tags) { this.tags = tags; }

    public int getTotalPriceCents() { return totalPriceCents; }
    public void setTotalPriceCents(int totalPriceCents) { this.totalPriceCents = totalPriceCents; }

    public int getQuotedPriceCents() { return quotedPriceCents; }
    public void setQuotedPriceCents(int quotedPriceCents) { this.quotedPriceCents = quotedPriceCents; }

    public int getAdvancePaidCents() { return advancePaidCents; }
    public void setAdvancePaidCents(int advancePaidCents) { this.advancePaidCents = advancePaidCents; }

    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }

    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getCancelledReason() { return cancelledReason; }
    public void setCancelledReason(String cancelledReason) { this.cancelledReason = cancelledReason; }

    public Instant getDeletedAt() { return deletedAt; }
    public void setDeletedAt(Instant deletedAt) { this.deletedAt = deletedAt; }

    public Instant getCreatedAt() { return createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }

    public int getVersion() { return version; }
}
