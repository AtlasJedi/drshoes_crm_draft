package com.drshoes.lib.storage;

import java.time.Instant;

public record PresignedUrl(String url, Instant expiresAt) {}
