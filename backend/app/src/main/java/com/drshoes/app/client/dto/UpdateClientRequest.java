package com.drshoes.app.client.dto;

import jakarta.validation.constraints.Size;

public record UpdateClientRequest(
    @Size(max = 80) String firstName,
    @Size(max = 80) String lastName,
    @Size(max = 40) String phone,
    @Size(max = 120) String email,
    @Size(max = 2000) String notes
) {}
