package com.drshoes.lib.email.postmark;

import com.drshoes.lib.email.EmailGateway;
import com.drshoes.lib.messaging.Channel;
import com.drshoes.lib.messaging.DeliveryReceipt;
import com.drshoes.lib.messaging.DeliveryStatus;
import com.drshoes.lib.messaging.OutboundMessage;
import com.drshoes.lib.storage.BlobKey;
import com.drshoes.lib.storage.BlobStorage;
import org.springframework.http.MediaType;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClient;

import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import lombok.RequiredArgsConstructor;
@Slf4j
@RequiredArgsConstructor
public class PostmarkEmailGateway implements EmailGateway {

    private final RestClient restClient;
    private final PostmarkProperties props;
    private final BlobStorage blobStorage;

    @Override
    public Channel channel() { return Channel.EMAIL; }

    @Override
    public DeliveryReceipt send(OutboundMessage m) {
        Map<String, byte[]> attachmentBytes = fetchAttachmentBytes(m);
        if (attachmentBytes == null) {
            log.warn("op=postmark.send outcome=failed errorCode=ATTACHMENT_TOO_LARGE idemKey={}",
                    m.idempotencyKey());
            return DeliveryReceipt.failed("ATTACHMENT_TOO_LARGE",
                    "Total attachment size exceeds 10 MB Postmark limit");
        }

        Map<String, Object> payload;
        try {
            payload = PostmarkPayloadMapper.toPayload(
                    m, attachmentBytes, props.getMessageStream(), props.getFrom());
        } catch (IllegalArgumentException e) {
            log.warn("op=postmark.send outcome=failed errorCode=ATTACHMENT_TOO_LARGE idemKey={} errorMessage={}",
                    m.idempotencyKey(), e.getMessage());
            return DeliveryReceipt.failed("ATTACHMENT_TOO_LARGE", e.getMessage());
        }

        return executeWithRetry(m, payload);
    }
    private Map<String, byte[]> fetchAttachmentBytes(OutboundMessage m) {
        Map<String, byte[]> result = new HashMap<>();
        long total = 0;
        for (var att : m.attachments()) {
            try (InputStream is = blobStorage.get(new BlobKey(att.storageKey()))) {
                byte[] bytes = is.readAllBytes();
                total += bytes.length;
                if (total > 10L * 1024 * 1024) return null;
                result.put(att.storageKey(), bytes);
            } catch (Exception e) {
                log.warn("op=postmark.fetchAttachment outcome=error attachment={} idemKey={}",
                        att.storageKey(), m.idempotencyKey(), e);
                throw new RuntimeException("Failed to fetch attachment: " + att.storageKey(), e);
            }
        }
        return result;
    }

    private DeliveryReceipt executeWithRetry(OutboundMessage m, Map<String, Object> payload) {
        long start = System.currentTimeMillis();
        try {
            return doPost(m, payload, start);
        } catch (RestClientException e) {
            if (!isNetworkError(e)) {
                throw e;
            }
            log.warn("op=postmark.send outcome=networkErrorAttempt1 idemKey={} error={}",
                    m.idempotencyKey(), e.getMessage());
            try {
                Thread.sleep(1_000);
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
            }
            try {
                return doPost(m, payload, start);
            } catch (RestClientException e2) {
                long durationMs = System.currentTimeMillis() - start;
                if (isNetworkError(e2)) {
                    log.warn("op=postmark.send outcome=failed errorCode=NETWORK idemKey={} durationMs={} error={}",
                            m.idempotencyKey(), durationMs, e2.getMessage());
                    return DeliveryReceipt.failed("NETWORK", e2.getMessage());
                }
                throw e2;
            }
        }
    }
    private static boolean isNetworkError(RestClientException e) {
        if (e instanceof ResourceAccessException) return true;
        Throwable cause = e.getCause();
        while (cause != null) {
            if (cause instanceof IOException) return true;
            cause = cause.getCause();
        }
        return false;
    }

    private DeliveryReceipt doPost(OutboundMessage m, Map<String, Object> payload, long startMs) {
        var responseEntity = restClient.post()
                .uri("/email")
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Postmark-Server-Token", props.getServerToken())
                .body(payload)
                .retrieve()
                .onStatus(status -> !status.is2xxSuccessful(),
                          (req, resp) -> {
                          })
                .toEntity(String.class);

        int status = responseEntity.getStatusCode().value();
        String body = responseEntity.getBody() != null ? responseEntity.getBody() : "";

        DeliveryReceipt receipt = PostmarkResponseMapper.fromResponse(status, body);
        long durationMs = System.currentTimeMillis() - startMs;

        if (receipt.initialStatus() == DeliveryStatus.SENT) {
            log.info("op=postmark.send outcome=success providerMessageId={} idemKey={} recipientLast4={} durationMs={}",
                    receipt.providerMessageId(), m.idempotencyKey(), last4(m.recipient()), durationMs);
        } else {
            log.warn("op=postmark.send outcome=failed errorCode={} errorMessage={} idemKey={} recipientLast4={} durationMs={}",
                    receipt.errorCode(), receipt.errorMessage(), m.idempotencyKey(),
                    last4(m.recipient()), durationMs);
        }
        return receipt;
    }

    private static String last4(String recipient) {
        if (recipient == null || recipient.length() < 4) return "****";
        return recipient.substring(recipient.length() - 4);
    }
}
