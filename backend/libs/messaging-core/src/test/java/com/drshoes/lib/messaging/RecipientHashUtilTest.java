package com.drshoes.lib.messaging;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class RecipientHashUtilTest {

    @Test
    void hashFirst8Hex_returnsExactly8Characters() {
        String hash = RecipientHashUtil.hashFirst8Hex("+48500600700");
        assertThat(hash).hasSize(8);
    }

    @Test
    void hashFirst8Hex_returnsLowercaseHex() {
        String hash = RecipientHashUtil.hashFirst8Hex("client@example.com");
        assertThat(hash).matches("[0-9a-f]{8}");
    }

    @Test
    void hashFirst8Hex_isDeterministic() {
        String h1 = RecipientHashUtil.hashFirst8Hex("+48123456789");
        String h2 = RecipientHashUtil.hashFirst8Hex("+48123456789");
        assertThat(h1).isEqualTo(h2);
    }

    @Test
    void hashFirst8Hex_differentiatesDistinctRecipients() {
        String h1 = RecipientHashUtil.hashFirst8Hex("+48111111111");
        String h2 = RecipientHashUtil.hashFirst8Hex("+48222222222");
        assertThat(h1).isNotEqualTo(h2);
    }
}
