package com.drshoes.app.photo.dto;

import com.drshoes.app.photo.domain.PhotoLabel;

/**
 * Request body for PATCH /api/admin/photos/{id} — change the photo's label.
 */
public record RelabelPhotoRequest(PhotoLabel label) {}
