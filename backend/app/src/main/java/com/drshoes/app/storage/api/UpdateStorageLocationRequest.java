package com.drshoes.app.storage.api;

import jakarta.validation.constraints.Size;

public record UpdateStorageLocationRequest(
    @Size(max = 64) String name,
    Integer position,
    Boolean active
) {}
