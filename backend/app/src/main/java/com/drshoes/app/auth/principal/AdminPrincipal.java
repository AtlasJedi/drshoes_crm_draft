package com.drshoes.app.auth.principal;

import java.io.Serial;
import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

/**
 * Typed principal stored inside Spring Security's {@code Authentication} after a successful
 * admin login. Allows controllers to receive the full user identity (userId, email, role)
 * via {@code @AuthenticationPrincipal AdminPrincipal} without a per-request DB lookup.
 *
 * <h2>Backwards compatibility</h2>
 * {@code UsernamePasswordAuthenticationToken#getName()} delegates to
 * {@code principal.toString()} when the principal is not a {@code UserDetails} or
 * {@code Principal}. We override {@code toString()} to return the email so all existing
 * callers of {@code auth.getName()} keep working unchanged until task 3-4 retrofits them.
 *
 * <h2>Serialization</h2>
 * Must implement {@code Serializable} — Spring Session JDBC stores the entire
 * {@code SecurityContext} (including this principal) as a Java-serialized blob in the
 * {@code spring_session_attributes} table. Without {@code Serializable} the session
 * save would throw {@code NotSerializableException}.
 *
 * <h2>Null-safety</h2>
 * All three fields are mandatory. The compact constructor enforces this.
 */
public record AdminPrincipal(UUID userId, String email, String role) implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    public AdminPrincipal {
        Objects.requireNonNull(userId, "userId must not be null");
        Objects.requireNonNull(email,  "email must not be null");
        Objects.requireNonNull(role,   "role must not be null");
    }

    /**
     * Returns the email so that {@code Authentication.getName()} keeps returning the email
     * for all existing callers (backwards-compatible until they are retrofitted to use
     * {@code actor.email()} / {@code actor.userId()} directly).
     */
    @Override
    public String toString() {
        return email;
    }
}
