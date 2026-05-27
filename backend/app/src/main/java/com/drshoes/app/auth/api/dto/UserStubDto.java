package com.drshoes.app.auth.api.dto;

import com.drshoes.app.auth.domain.User;
import com.drshoes.app.auth.domain.UserRole;

import java.util.UUID;
public record UserStubDto(UUID id, String fullName, UserRole role) {

    public static UserStubDto of(User u) {
        return new UserStubDto(u.getId(), u.getFullName(), u.getRole());
    }
}
