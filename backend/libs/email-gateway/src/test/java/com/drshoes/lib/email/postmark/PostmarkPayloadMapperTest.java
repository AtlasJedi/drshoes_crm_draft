package com.drshoes.lib.email.postmark;

import com.drshoes.lib.messaging.Attachment;
import com.drshoes.lib.messaging.Channel;
import com.drshoes.lib.messaging.OutboundMessage;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.*;

class PostmarkPayloadMapperTest {

    private static final String STREAM = "outbound";
    private static final String FROM   = "noreply@drshoes.pl";

    // ── Case 1: plain-text body ─────────────────────────────────────────────
    @Test
    void plainTextBody_emitsTextBody() {
        var msg = OutboundMessage.of(
                Channel.EMAIL, "jan@example.com", "Zlecenie #42",
                "Twoje buty są gotowe.", List.of(), "idem-1");

        Map<String, Object> payload = PostmarkPayloadMapper.toPayload(msg, Map.of(), STREAM, FROM);

        assertThat(payload).containsEntry("From", FROM)
                           .containsEntry("To", "jan@example.com")
                           .containsEntry("Subject", "Zlecenie #42")
                           .containsEntry("MessageStream", STREAM)
                           .containsEntry("TextBody", "Twoje buty są gotowe.")
                           .doesNotContainKey("HtmlBody")
                           .doesNotContainKey("Attachments");
    }

    // ── Case 2: HTML body ───────────────────────────────────────────────────
    @Test
    void htmlBody_emitsHtmlBody() {
        var msg = OutboundMessage.of(
                Channel.EMAIL, "jan@example.com", "Zlecenie #42",
                "<p>Twoje buty są gotowe.</p>", List.of(), "idem-2");

        Map<String, Object> payload = PostmarkPayloadMapper.toPayload(msg, Map.of(), STREAM, FROM);

        assertThat(payload).containsEntry("HtmlBody", "<p>Twoje buty są gotowe.</p>")
                           .doesNotContainKey("TextBody");
    }

    // ── Case 3: attachment included ─────────────────────────────────────────
    @Test
    @SuppressWarnings("unchecked")
    void withAttachment_emitsAttachmentsArray() {
        byte[] pdfBytes = "PDF-CONTENT".getBytes(StandardCharsets.UTF_8);
        // Attachment record: storageKey, mime, bytes
        var attachment  = new Attachment("report.pdf", "application/pdf", (long) pdfBytes.length);
        var msg = OutboundMessage.of(
                Channel.EMAIL, "jan@example.com", "Raport",
                "Zobacz załącznik.", List.of(attachment), "idem-3");
        Map<String, byte[]> bytes = Map.of("report.pdf", pdfBytes);

        Map<String, Object> payload = PostmarkPayloadMapper.toPayload(msg, bytes, STREAM, FROM);

        assertThat(payload).containsKey("Attachments");
        var attachments = (java.util.List<Map<String, String>>) payload.get("Attachments");
        assertThat(attachments).hasSize(1);
        Map<String, String> a = attachments.get(0);
        assertThat(a).containsEntry("Name", "report.pdf")
                     .containsEntry("ContentType", "application/pdf")
                     .containsEntry("Content", Base64.getEncoder().encodeToString(pdfBytes));
    }

    // ── Case 4: attachment total > 10 MB throws ─────────────────────────────
    @Test
    void attachmentExceeds10MB_throwsIllegalArgument() {
        byte[] big = new byte[10 * 1024 * 1024 + 1];
        var attachment = new Attachment("big.bin", "application/octet-stream", (long) big.length);
        var msg = OutboundMessage.of(
                Channel.EMAIL, "jan@example.com", "Big",
                "Duzy plik.", List.of(attachment), "idem-4");
        Map<String, byte[]> bytes = Map.of("big.bin", big);

        assertThatThrownBy(() -> PostmarkPayloadMapper.toPayload(msg, bytes, STREAM, FROM))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("10 MB");
    }
}
