package com.drshoes.app.client.dto;

import com.drshoes.app.client.domain.Client;

import java.time.Instant;
import java.util.UUID;

public record ClientDto(
    UUID id, String firstName, String lastName, String phone, String email, String notes,
    Instant createdAt, Instant updatedAt
) {
    public static ClientDto of(Client c) {
        return new ClientDto(c.getId(), c.getFirstName(), c.getLastName(),
            c.getPhone(), c.getEmail(), c.getNotes(),
            c.getCreatedAt(), c.getUpdatedAt());
    }
}
