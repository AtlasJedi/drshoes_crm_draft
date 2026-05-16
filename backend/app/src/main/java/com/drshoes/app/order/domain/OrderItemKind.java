package com.drshoes.app.order.domain;

/**
 * Kind of work for an OrderItem, matching V025 CHECK constraint.
 * V025 migrated CUSTOM_BUTY + CUSTOM_KURTKA into a single CUSTOM value.
 */
public enum OrderItemKind {
    NAPRAWA,
    CUSTOM
}
