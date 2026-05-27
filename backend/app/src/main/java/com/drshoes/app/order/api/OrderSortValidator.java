package com.drshoes.app.order.api;

import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import java.util.Set;
public class OrderSortValidator {
    static final Set<String> ALLOWED_FIELDS = Set.of(
        "receivedAt", "createdAt", "code", "status", "pickedUpAt"
    );

    private OrderSortValidator() {}
    public static void validate(Pageable pageable) {
        for (Sort.Order o : pageable.getSort()) {
            if (!ALLOWED_FIELDS.contains(o.getProperty())) {
                throw new InvalidSortFieldException(o.getProperty(), ALLOWED_FIELDS);
            }
        }
    }
}
