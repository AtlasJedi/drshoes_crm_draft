package com.drshoes.app.client.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "client")
@Getter
@Setter
public class Client {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "first_name", nullable = false, length = 80)
    private String firstName;

    @Column(name = "last_name", length = 80)
    private String lastName;

    @Column(length = 32)
    private String phone;

    @Column(columnDefinition = "citext")
    private String email;

    @Column(name = "preferred_channel", nullable = false, length = 16)
    private String preferredChannel = "EMAIL";

    @Column(columnDefinition = "text")
    private String notes;

    @Column(name = "rodo_consent_at")
    private Instant rodoConsentAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @Column(name = "deleted_at")
    private Instant deletedAt;

    @PreUpdate
    void onUpdate() { this.updatedAt = Instant.now(); }
    public void setFirstName(String v) { this.firstName = v; }
    public void setPhone(String v) { this.phone = v; }
    public void setPreferredChannel(String v) { this.preferredChannel = v; }
    public void setRodoConsentAt(Instant v) { this.rodoConsentAt = v; }

    public String getFullName() {
        if (firstName == null) return lastName == null ? "" : lastName;
        if (lastName == null) return firstName;
        return firstName + " " + lastName;
    }
}
