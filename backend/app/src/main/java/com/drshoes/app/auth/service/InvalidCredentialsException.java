package com.drshoes.app.auth.service;

public class InvalidCredentialsException extends RuntimeException {
    public InvalidCredentialsException() { super("invalid credentials"); }
}
