package com.drshoes.app.auth.service;

public class LoginThrottledException extends RuntimeException {
    public LoginThrottledException() { super("too many login attempts"); }
}
