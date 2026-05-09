package com.drshoes.lib.email.postmark;

import com.drshoes.lib.messaging.DeliveryReceipt;
import com.drshoes.lib.messaging.DeliveryStatus;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.*;

class PostmarkResponseMapperTest {

    // ── Case 1: 200 + ErrorCode 0 ─────────────────────────────────────────
    @Test
    void http200_errorCode0_returnsAccepted() {
        String body = """
                {"ErrorCode":0,"Message":"OK","MessageID":"abc-123",
                 "SubmittedAt":"2026-05-09T10:00:00Z","To":"jan@example.com"}
                """;

        DeliveryReceipt receipt = PostmarkResponseMapper.fromResponse(200, body);

        assertThat(receipt.initialStatus()).isEqualTo(DeliveryStatus.SENT);
        assertThat(receipt.providerMessageId()).isEqualTo("abc-123");
        assertThat(receipt.errorCode()).isNull();
    }

    // ── Case 2: 200 + ErrorCode != 0 ─────────────────────────────────────
    @Test
    void http200_inlineError_returnsFailedWithPostmarkCode() {
        String body = """
                {"ErrorCode":10,"Message":"Bad or missing API token."}
                """;

        DeliveryReceipt receipt = PostmarkResponseMapper.fromResponse(200, body);

        assertThat(receipt.initialStatus()).isEqualTo(DeliveryStatus.FAILED);
        assertThat(receipt.errorCode()).isEqualTo("POSTMARK-10");
        assertThat(receipt.errorMessage()).isEqualTo("Bad or missing API token.");
        assertThat(receipt.providerMessageId()).isNull();
    }

    // ── Case 3: 422 Unprocessable ─────────────────────────────────────────
    @Test
    void http422_returnsFailedWithHttpCode() {
        String body = "{\"ErrorCode\":300,\"Message\":\"Invalid 'From' address.\"}";

        DeliveryReceipt receipt = PostmarkResponseMapper.fromResponse(422, body);

        assertThat(receipt.initialStatus()).isEqualTo(DeliveryStatus.FAILED);
        assertThat(receipt.errorCode()).isEqualTo("HTTP-422");
        assertThat(receipt.errorMessage()).isEqualTo(body);
    }

    // ── Case 4: 500 Server Error ──────────────────────────────────────────
    @Test
    void http500_returnsFailedWithHttpCode() {
        String body = "Internal Server Error";

        DeliveryReceipt receipt = PostmarkResponseMapper.fromResponse(500, body);

        assertThat(receipt.initialStatus()).isEqualTo(DeliveryStatus.FAILED);
        assertThat(receipt.errorCode()).isEqualTo("HTTP-500");
        assertThat(receipt.errorMessage()).isEqualTo(body);
    }
}
