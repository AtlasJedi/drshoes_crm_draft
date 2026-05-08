package com.drshoes.app.auth.api.dto;

import com.drshoes.app.auth.domain.UserRole;

import java.time.Instant;
import java.util.UUID;

public record MeResponse(UUID id, String email, String fullName, UserRole role, Instant lastLoginAt) {}
