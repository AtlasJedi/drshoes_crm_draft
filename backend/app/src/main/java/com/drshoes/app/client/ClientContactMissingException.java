package com.drshoes.app.client;
public class ClientContactMissingException extends RuntimeException {
    public ClientContactMissingException() {
        super("At least one of phone or email is required");
    }
}
