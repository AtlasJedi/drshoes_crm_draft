package com.drshoes.app.storage.service;

public class LocationConflictException extends RuntimeException {
    public LocationConflictException(String name) {
        super("location name already exists: " + name);
    }
}
