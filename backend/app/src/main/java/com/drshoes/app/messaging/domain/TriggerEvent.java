package com.drshoes.app.messaging.domain;

public enum TriggerEvent {
    STATUS_CHANGE,
    STATUS_CHANGE_FROM,
    ORDER_RECEIVED,
    BEFORE_PICKUP_X_DAYS,
    AFTER_HANDOVER_Y_DAYS,
    RESERVATION_EXPIRING
}
