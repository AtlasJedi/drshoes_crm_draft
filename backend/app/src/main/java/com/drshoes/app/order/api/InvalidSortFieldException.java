package com.drshoes.app.order.api;

import java.util.Set;
import lombok.Getter;

@Getter
public class InvalidSortFieldException extends RuntimeException {

    private final String field;
    private final Set<String> allowed;

    public InvalidSortFieldException(String field, Set<String> allowed) {
        super("Invalid sort field: " + field + ", allowed: " + allowed);
        this.field = field;
        this.allowed = allowed;
    }
}
