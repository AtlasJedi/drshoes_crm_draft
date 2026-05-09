package com.drshoes.lib.sms.smsapi;

import com.drshoes.lib.messaging.DeliveryReceipt;
import com.drshoes.lib.messaging.DeliveryStatus;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SmsApiResponseMapperTest {

    // ── Case 1: success response ─────────────────────────────────────────
    // TODO(plan-errata #6): response list[0].id confirmed as the stable message ID
    //   field per smsapi.pl/docs 2026-05-09. Shape matches plan.
    @Test
    void successEnvelope_returnsAccepted() {
        String body = """
                {"list":[{"id":"sms-abc","status":"QUEUE","number":"+48600100200",
                          "date_sent":1715250000,"submitted_number":"+48600100200",
                          "points":0.160,"encoding":"utf-8","idx":"idem-sms-1"}],
                 "count":1}
                """;

        DeliveryReceipt receipt = SmsApiResponseMapper.fromResponse(200, body);

        assertThat(receipt.initialStatus()).isEqualTo(DeliveryStatus.SENT);
        assertThat(receipt.providerMessageId()).isEqualTo("sms-abc");
        assertThat(receipt.errorCode()).isNull();
    }

    // ── Case 2: error envelope ────────────────────────────────────────────
    @Test
    void errorEnvelope_returnsFailedWithSmsApiCode() {
        String body = """
                {"error":13,"message":"Wrong phone number"}
                """;

        DeliveryReceipt receipt = SmsApiResponseMapper.fromResponse(200, body);

        assertThat(receipt.initialStatus()).isEqualTo(DeliveryStatus.FAILED);
        assertThat(receipt.errorCode()).isEqualTo("SMSAPI-13");
        assertThat(receipt.errorMessage()).isEqualTo("Wrong phone number");
    }

    // ── Case 3: HTTP 400 → failed without JSON parsing ────────────────────
    @Test
    void http400_returnsFailedHttpCode() {
        DeliveryReceipt receipt = SmsApiResponseMapper.fromResponse(400, "Bad Request");

        assertThat(receipt.initialStatus()).isEqualTo(DeliveryStatus.FAILED);
        assertThat(receipt.errorCode()).isEqualTo("HTTP-400");
        assertThat(receipt.errorMessage()).isEqualTo("Bad Request");
    }

    // ── Case 4: HTTP 500 → failed without JSON parsing ────────────────────
    @Test
    void http500_returnsFailedHttpCode() {
        DeliveryReceipt receipt = SmsApiResponseMapper.fromResponse(500, "Internal Server Error");

        assertThat(receipt.initialStatus()).isEqualTo(DeliveryStatus.FAILED);
        assertThat(receipt.errorCode()).isEqualTo("HTTP-500");
        assertThat(receipt.errorMessage()).isEqualTo("Internal Server Error");
    }
}
