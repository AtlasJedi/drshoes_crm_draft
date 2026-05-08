package com.drshoes.app.photo.service;

public class PhotoTooLargeException extends RuntimeException {
    public PhotoTooLargeException(long size, long max) {
        super("Photo too large: " + size + " bytes (max " + max + ")");
    }
}
