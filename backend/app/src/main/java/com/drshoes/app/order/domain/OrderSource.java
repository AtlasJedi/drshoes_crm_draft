package com.drshoes.app.order.domain;

/**
 * Source channel for an Order, matching V001 CHECK constraint.
 */
public enum OrderSource {
    ADMIN,
    PUBLIC_INTAKE,
    IMPORT
}
