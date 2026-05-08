package com.drshoes.app.client.dto;

import com.drshoes.app.client.domain.Client;

import java.util.UUID;

public record ClientSearchResult(UUID id, String fullName, String phone, String email) {
    public static ClientSearchResult of(Client c) {
        String lastName = c.getLastName() != null ? c.getLastName() : "";
        String fullName = (c.getFirstName() + " " + lastName).trim();
        return new ClientSearchResult(c.getId(), fullName, c.getPhone(), c.getEmail());
    }
}
