package com.drshoes.app.order.domain;

/**
 * Kind of work for an OrderItem, matching V029 CHECK constraint.
 * V025 merged CUSTOM_BUTY + CUSTOM_KURTKA → CUSTOM.
 * V029 added USLUGA (general service) and RENOWACJA (restoration).
 */
public enum OrderItemKind {
    USLUGA,
    CUSTOM,
    NAPRAWA,
    RENOWACJA
}
