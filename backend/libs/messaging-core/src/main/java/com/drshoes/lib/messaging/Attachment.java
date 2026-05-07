package com.drshoes.lib.messaging;

import java.util.Objects;

public record Attachment(String storageKey, String mime, Long bytes) {
    public Attachment {
        Objects.requireNonNull(storageKey, "storageKey");
        Objects.requireNonNull(mime, "mime");
    }
}
