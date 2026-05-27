package com.drshoes.app.order.domain;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
@Entity
@Table(name = "order_")
@Getter
@Setter
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
    public void setCode(String code) { this.code = code; }
    public void setStatus(OrderStatus status) { this.status = status; }
    public void setReceivedAt(Instant receivedAt) { this.receivedAt = receivedAt; }
    public void setPickedUpAt(Instant pickedUpAt) { this.pickedUpAt = pickedUpAt; }
    public void setCurrentStorageLocationId(UUID currentStorageLocationId) { this.currentStorageLocationId = currentStorageLocationId; }
    public void setTotalPriceCents(int totalPriceCents) { this.totalPriceCents = totalPriceCents; }
    public void setAdvancePaidCents(int advancePaidCents) { this.advancePaidCents = advancePaidCents; }
    public void setLocation(String location) { this.location = location; }
    public void setCancelledReason(String cancelledReason) { this.cancelledReason = cancelledReason; }

}
