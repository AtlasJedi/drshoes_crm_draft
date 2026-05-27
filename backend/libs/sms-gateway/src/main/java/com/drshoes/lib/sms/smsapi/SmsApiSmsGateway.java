package com.drshoes.lib.sms.smsapi;

import com.drshoes.lib.messaging.Channel;
import com.drshoes.lib.messaging.DeliveryReceipt;
import com.drshoes.lib.messaging.DeliveryStatus;
import com.drshoes.lib.messaging.OutboundMessage;
import com.drshoes.lib.sms.SmsGateway;
import org.springframework.http.MediaType;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import lombok.RequiredArgsConstructor;
@Slf4j
@RequiredArgsConstructor
public class SmsApiSmsGateway implements SmsGateway {

    private final RestClient restClient;
    private final SmsApiProperties props;

    @Override
    public Channel channel() { return Channel.SMS; }

    @Override
    public DeliveryReceipt send(OutboundMessage m) {
        Map<String, Object> payload = new LinkedHashMap<>(
                SmsApiPayloadMapper.toPayload(m, props.getFrom()));
        if (m.idempotencyKey() != null && !m.idempotencyKey().isBlank()) {
            payload.put("check_idx", 1);
        }
        return executeWithRetry(m, payload);
    }

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
