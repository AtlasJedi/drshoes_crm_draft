package com.drshoes.app.client;

/**
 * Thrown when a Client operation would violate the client_contact_present invariant:
 * at least one of phone or email must be non-null and non-blank.
 */
public class ClientContactMissingException extends RuntimeException {
    public ClientContactMissingException() {
        super("At least one of phone or email is required");
    }
}
