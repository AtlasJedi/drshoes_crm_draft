package com.drshoes.app.order.domain;

/**
 * Lifecycle statuses for an Order, matching the CHECK constraint in V001.
 * Polish values match the DB CHECK: WSTEPNIE_PRZYJETE, PRZYJETE, W_REALIZACJI,
 * CZEKA_NA_KLIENTA, GOTOWE_DO_ODBIORU, WYDANE, ANULOWANE.
 */
public enum OrderStatus {
    WSTEPNIE_PRZYJETE,
    PRZYJETE,
    W_REALIZACJI,
    CZEKA_NA_KLIENTA,
    GOTOWE_DO_ODBIORU,
    WYDANE,
    ANULOWANE
}
