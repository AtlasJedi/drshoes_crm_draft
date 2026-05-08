package com.drshoes.app.photo.service;

import java.util.UUID;

public class PhotoNotFoundException extends RuntimeException {
    public PhotoNotFoundException(UUID id) {
        super("Photo not found: " + id);
    }
}
