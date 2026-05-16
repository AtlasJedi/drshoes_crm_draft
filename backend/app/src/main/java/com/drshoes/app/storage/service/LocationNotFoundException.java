package com.drshoes.app.storage.service;

public class LocationNotFoundException extends RuntimeException {
    public LocationNotFoundException(Long id) {
        super("storage_location not found: id=" + id);
    }
}
