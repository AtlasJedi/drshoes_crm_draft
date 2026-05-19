package com.drshoes.app.order.domain;

/**
 * Kind of work for an OrderItem, matching V033 CHECK constraint.
 * V025 merged CUSTOM_BUTY + CUSTOM_KURTKA → CUSTOM.
 * V029 added USLUGA and RENOWACJA (superseded by V033).
 * V033 (2026-05-19): owner directive — replace all 4 old values with 5 new ones.
 * Declaration order is canonical UI dropdown order.
 */
public enum OrderItemKind {
    CZYSZCZENIE, // default for new items
    RENOWACJA,
    NAPRAWA,
    SZEWC,
    CUSTOM
}
