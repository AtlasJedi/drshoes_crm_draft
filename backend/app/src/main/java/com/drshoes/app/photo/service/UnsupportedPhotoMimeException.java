package com.drshoes.app.photo.service;

public class UnsupportedPhotoMimeException extends RuntimeException {
    public UnsupportedPhotoMimeException(String mime) {
        super("Unsupported photo mime: " + mime);
    }
}
