package com.drshoes.app.order.api;

import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import java.util.Set;

/**
 * Validates that all sort properties requested via Pageable are in the explicit allowlist.
 * Prevents SQL injection via arbitrary Pageable sort fields.
 *
 * Allowed sort fields correspond to JPA entity fields on {@code Order}:
 *   receivedAt, createdAt, code, status, pickedUpAt
 *
 * Note: clientLastName is NOT included — sorting by client name would require
 * a JOIN against the client table that the current Specification-based repository
 * does not support. Deferred until a projection query or DB view is added.
 *
 * Usage: call {@link #validate(Pageable)} in the controller; throws
 * {@link InvalidSortFieldException} on a disallowed field.
 */
public final class OrderSortValidator {

    /** JPA entity field names allowed as sort properties. */
    static final Set<String> ALLOWED_FIELDS = Set.of(
        "receivedAt", "createdAt", "code", "status", "pickedUpAt"
    );

    private OrderSortValidator() {}

    /**
     * Validates that every sort property in the pageable is in the allowlist.
     *
     * @param pageable the Pageable from the HTTP request
     * @throws InvalidSortFieldException if any sort property is not in the allowlist
     */
    public static void validate(Pageable pageable) {
        for (Sort.Order o : pageable.getSort()) {
            if (!ALLOWED_FIELDS.contains(o.getProperty())) {
                throw new InvalidSortFieldException(o.getProperty(), ALLOWED_FIELDS);
            }
        }
    }
}
