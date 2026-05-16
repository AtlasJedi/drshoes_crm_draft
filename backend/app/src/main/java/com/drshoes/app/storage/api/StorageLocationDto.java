package com.drshoes.app.storage.api;

import com.drshoes.app.storage.domain.StorageLocation;

public record StorageLocationDto(Long id, String name, int position, boolean active) {
    public static StorageLocationDto from(StorageLocation l) {
        return new StorageLocationDto(l.getId(), l.getName(), l.getPosition(), l.isActive());
    }
}
