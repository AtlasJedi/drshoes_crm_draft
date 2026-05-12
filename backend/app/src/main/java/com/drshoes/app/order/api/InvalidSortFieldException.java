package com.drshoes.app.order.api;

import java.util.Set;

/**
 * Thrown when the caller requests a sort on a field not in the explicit allowlist.
 * Mapped to HTTP 400 by the global exception handler.
 */
public class InvalidSortFieldException extends RuntimeException {

    private final String field;
    private final Set<String> allowed;

    public InvalidSortFieldException(String field, Set<String> allowed) {
        super("Sort field not allowed: '" + field + "'. Allowed: " + allowed);
        this.field   = field;
        this.allowed = allowed;
    }

    public String getField() { return field; }
    public Set<String> getAllowed() { return allowed; }
}
