package com.drshoes.app.storage.domain;

import jakarta.persistence.*;
import java.time.Instant;

/**
 * Storage location administered as a simple string set.
 *
 * Design: see docs/superpowers/specs/2026-05-16-m10-notes-and-locations-design.md
 * — owner directive "simple CRM, no IDs in UX". The id is internal only.
 */
@Entity
@Table(name = "storage_location")
public class StorageLocation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 64, unique = true)
    private String name;

    @Column(nullable = false)
    private int position = 0;

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @PreUpdate
    void onUpdate() { this.updatedAt = Instant.now(); }

    public Long getId() { return id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public int getPosition() { return position; }
    public void setPosition(int position) { this.position = position; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
