package com.drshoes.app.storage.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateStorageLocationRequest(
    @NotBlank @Size(max = 64) String name
) {}
