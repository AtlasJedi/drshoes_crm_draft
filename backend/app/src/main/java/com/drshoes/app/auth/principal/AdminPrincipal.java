package com.drshoes.app.auth.principal;

import java.io.Serial;
import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;
public record AdminPrincipal(UUID userId, String email, String role) implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    public AdminPrincipal {
        Objects.requireNonNull(userId, "userId must not be null");
        Objects.requireNonNull(email,  "email must not be null");
        Objects.requireNonNull(role,   "role must not be null");
    }
    @Override
    public String toString() {
        return email;
    }
}
