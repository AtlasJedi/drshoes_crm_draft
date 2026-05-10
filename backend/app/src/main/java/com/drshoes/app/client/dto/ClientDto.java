package com.drshoes.app.client.dto;

import com.drshoes.app.client.domain.Client;

import java.time.Instant;
import java.util.UUID;

/**
 * Full client projection returned by read + mutation endpoints.
 *
 * preferredChannel and rodoConsentAt were previously absent from the record
 * (entity-level concern only). Added in M7 task 7-1 to support the client
 * dossier page header and the EditClientModal response.
 */
public record ClientDto(
    UUID id,
    String firstName,
    String lastName,
    String phone,
    String email,
    String preferredChannel,
    String notes,
    Instant rodoConsentAt,
    Instant createdAt,
    Instant updatedAt
) {
    public static ClientDto of(Client c) {
        return new ClientDto(
            c.getId(), c.getFirstName(), c.getLastName(),
            c.getPhone(), c.getEmail(),
            c.getPreferredChannel(), c.getNotes(),
            c.getRodoConsentAt(),
            c.getCreatedAt(), c.getUpdatedAt());
    }
}
