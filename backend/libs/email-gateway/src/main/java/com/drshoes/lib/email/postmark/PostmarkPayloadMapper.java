package com.drshoes.lib.email.postmark;

import com.drshoes.lib.messaging.Attachment;
import com.drshoes.lib.messaging.OutboundMessage;

import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Pure mapping utility: OutboundMessage + attachment bytes → Postmark JSON payload.
 *
 * Body-sniff rule: if body contains {@code <}, it is treated as HTML and emitted as
 * {@code HtmlBody}; otherwise {@code TextBody}. Plan errata #1: if a body legitimately
 * contains {@code <} but is not HTML, callers must HTML-encode the string or await a
 * future {@code isHtml} flag on OutboundMessage.
 *
 * Attachment cap: 10 MB total. Throws {@link IllegalArgumentException} when exceeded.
 * The gateway (task 4-4) catches and converts to DeliveryReceipt.failed("ATTACHMENT_TOO_LARGE").
 *
 * Attachment bytes are looked up by {@link Attachment#storageKey()} from the supplied map.
 */
public final class PostmarkPayloadMapper {

    private static final long MAX_ATTACHMENT_BYTES = 10L * 1024 * 1024;

    private PostmarkPayloadMapper() {}

    /**
     * @param msg             the message to map
     * @param attachmentBytes map from Attachment#storageKey() to raw bytes; may be empty
     * @param messageStream   Postmark message stream (e.g. "outbound")
     * @param from            sender address (e.g. "noreply@drshoes.pl")
     * @return Jackson-serialisable map representing the Postmark /email request body
     * @throws IllegalArgumentException if total attachment bytes exceed 10 MB
     */
    public static Map<String, Object> toPayload(
            OutboundMessage msg,
            Map<String, byte[]> attachmentBytes,
            String messageStream,
            String from) {

        long totalBytes = attachmentBytes.values().stream().mapToLong(b -> b.length).sum();
        if (totalBytes > MAX_ATTACHMENT_BYTES) {
            throw new IllegalArgumentException(
                    "Total attachment size " + totalBytes + " bytes exceeds 10 MB Postmark limit");
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("From", from);
        payload.put("To", msg.recipient());
        payload.put("Subject", msg.subject());
        payload.put("MessageStream", messageStream);

        boolean isHtml = msg.body().contains("<");
        if (isHtml) {
            payload.put("HtmlBody", msg.body());
        } else {
            payload.put("TextBody", msg.body());
        }

        if (!msg.attachments().isEmpty() && !attachmentBytes.isEmpty()) {
            List<Map<String, String>> attachments = new ArrayList<>();
            for (Attachment att : msg.attachments()) {
                byte[] bytes = attachmentBytes.get(att.storageKey());
                if (bytes == null) continue;
                Map<String, String> a = new LinkedHashMap<>();
                a.put("Name", att.storageKey());
                a.put("ContentType", att.mime());
                a.put("Content", Base64.getEncoder().encodeToString(bytes));
                attachments.add(a);
            }
            if (!attachments.isEmpty()) {
                payload.put("Attachments", attachments);
            }
        }

        return payload;
    }
}
