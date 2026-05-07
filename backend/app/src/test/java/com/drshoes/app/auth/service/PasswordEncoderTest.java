package com.drshoes.app.auth.service;

import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;

class PasswordEncoderTest {

    @Test
    void bcrypt_hashes_with_cost_12_and_verifies() {
        PasswordEncoder enc = new PasswordEncoderConfig().passwordEncoder();
        String hash = enc.encode("supersecret");
        assertThat(hash).startsWith("$2");                 // BCrypt prefix
        assertThat(hash).contains("$12$");                 // strength 12
        assertThat(enc.matches("supersecret", hash)).isTrue();
        assertThat(enc.matches("nope", hash)).isFalse();
    }
}
