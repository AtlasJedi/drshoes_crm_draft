package com.drshoes.lib.storage;

import java.util.Objects;

public record BlobKey(String value) {
    public BlobKey {
        Objects.requireNonNull(value, "value");
        if (value.isBlank() || value.startsWith("/")) {
            throw new IllegalArgumentException("blob key must be non-blank and not start with '/'");
        }
    }
}
