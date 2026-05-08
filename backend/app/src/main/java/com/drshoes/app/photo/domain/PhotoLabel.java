package com.drshoes.app.photo.domain;

/**
 * Photo classification label.
 * Mirrors the photo_label Postgres ENUM added in V009.
 * Full JPA entity mapping ships in task 3-5.
 */
public enum PhotoLabel {
    BEFORE,
    IN_PROGRESS,
    AFTER,
    OTHER
}
