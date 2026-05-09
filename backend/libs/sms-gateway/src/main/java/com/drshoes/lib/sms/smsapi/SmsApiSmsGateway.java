package com.drshoes.lib.sms.smsapi;

import com.drshoes.lib.messaging.Channel;
import com.drshoes.lib.messaging.DeliveryReceipt;
import com.drshoes.lib.messaging.DeliveryStatus;
import com.drshoes.lib.messaging.OutboundMessage;
import com.drshoes.lib.sms.SmsGateway;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * SMSAPI SMS gateway implementation.
 *
 * POSTs to ${apiBaseUrl}/sms.do with Authorization: Bearer &lt;token&gt; header.
 * Retry policy: one retry on ResourceAccessException (network/timeout), 1 s pause.
 * No retry on 4xx/5xx — terminal; operator-initiated retry only.
 *
 * Carry-forward #3 (plan-errata #6): adds check_idx=1 to the request payload
 * when msg.idempotencyKey() is non-null, activating SMSAPI's 24-h dedup window.
 *
 * No attachment support: SMS is body-only (no BlobStorage dependency).
 */
public class SmsApiSmsGateway implements SmsGateway {

    private static final Logger log = LoggerFactory.getLogger(SmsApiSmsGateway.class);

    private final RestClient restClient;
    private final SmsApiProperties props;

    public SmsApiSmsGateway(RestClient restClient, SmsApiProperties props) {
        this.restClient = restClient;
        this.props      = props;
    }

    @Override
    public Channel channel() { return Channel.SMS; }

    @Override
    public DeliveryReceipt send(OutboundMessage m) {
        // Build payload; add check_idx=1 when idempotencyKey present (dedup activation).
        Map<String, Object> payload = new LinkedHashMap<>(
                SmsApiPayloadMapper.toPayload(m, props.getFrom()));
        if (m.idempotencyKey() != null && !m.idempotencyKey().isBlank()) {
            payload.put("check_idx", 1);
        }
        return executeWithRetry(m, payload);
    }

    // ─── private helpers ────────────────────────────────────────────────────

    private DeliveryReceipt executeWithRetry(OutboundMessage m, Map<String, Object> payload) {
        try {
            return doPost(m, payload);
        } catch (RestClientException e) {
            if (!isNetworkError(e)) {
                throw e;
            }
            log.warn("op=smsapi.send outcome=networkErrorAttempt1 idemKey={} error={}",
                    m.idempotencyKey(), e.getMessage());
            try {
                Thread.sleep(1_000);
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
            }
            try {
                return doPost(m, payload);
            } catch (RestClientException e2) {
                if (isNetworkError(e2)) {
                    log.warn("op=smsapi.send outcome=failed errorCode=NETWORK idemKey={} error={}",
                            m.idempotencyKey(), e2.getMessage());
                    return DeliveryReceipt.failed("NETWORK", e2.getMessage());
                }
                throw e2;
            }
        }
    }

    /**
     * Returns true when the exception represents a network-level failure that should
     * trigger a retry. Covers both ResourceAccessException (the standard Spring wrapper
     * for IOException) and RestClientException wrapping an IOException directly
     * (which SimpleClientHttpRequestFactory can produce during header-read failure —
     * same pattern as PostmarkEmailGateway, see 4-4 dispatch log decision #2).
     */
    private static boolean isNetworkError(RestClientException e) {
        if (e instanceof ResourceAccessException) return true;
        Throwable cause = e.getCause();
        while (cause != null) {
            if (cause instanceof IOException) return true;
            cause = cause.getCause();
        }
        return false;
    }

    private DeliveryReceipt doPost(OutboundMessage m, Map<String, Object> payload) {
        var responseEntity = restClient.post()
                .uri("/sms.do")
                .contentType(MediaType.APPLICATION_JSON)
                .header("Authorization", "Bearer " + props.getToken())
                .body(payload)
                .retrieve()
                .onStatus(status -> !status.is2xxSuccessful(),
                          (req, resp) -> {
                              // suppress throw; capture status+body via toEntity below
                          })
                .toEntity(String.class);

        int status = responseEntity.getStatusCode().value();
        String body = responseEntity.getBody() != null ? responseEntity.getBody() : "";

        DeliveryReceipt receipt = SmsApiResponseMapper.fromResponse(status, body);

        if (receipt.initialStatus() == DeliveryStatus.SENT) {
            log.info("op=smsapi.send outcome=success providerMessageId={} idemKey={} recipientLast4={}",
                    receipt.providerMessageId(), m.idempotencyKey(), last4(m.recipient()));
        } else {
            log.warn("op=smsapi.send outcome=failed errorCode={} errorMessage={} idemKey={} recipientLast4={}",
                    receipt.errorCode(), receipt.errorMessage(), m.idempotencyKey(), last4(m.recipient()));
        }
        return receipt;
    }

    private static String last4(String recipient) {
        if (recipient == null || recipient.length() < 4) return "****";
        return recipient.substring(recipient.length() - 4);
    }
}
