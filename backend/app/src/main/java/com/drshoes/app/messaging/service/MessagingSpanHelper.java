package com.drshoes.app.messaging.service;

import com.drshoes.lib.messaging.RecipientHashUtil;
import io.opentelemetry.api.OpenTelemetry;
import io.opentelemetry.api.common.AttributeKey;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.trace.StatusCode;
import io.opentelemetry.api.trace.Tracer;
import io.opentelemetry.context.Scope;

import java.util.UUID;
import java.util.function.Supplier;

/**
 * OTel span factory helper for {@link MessageGatewayDispatcher}.
 *
 * <p>Extracted to keep the dispatcher under 120 LOC after span instrumentation.</p>
 *
 * <p>Recipient hashing: delegates to {@link RecipientHashUtil#hashFirst8Hex(String)}
 * (SHA-256 first-8-hex chars). Raw recipient is never emitted to telemetry.</p>
 */
public class MessagingSpanHelper {

    static final AttributeKey<String> CHANNEL        = AttributeKey.stringKey("messaging.channel");
    static final AttributeKey<String> MESSAGE_ID     = AttributeKey.stringKey("messaging.message_id");
    static final AttributeKey<String> RECIPIENT_HASH = AttributeKey.stringKey("messaging.recipient_hash");

    private final Tracer tracer;

    public MessagingSpanHelper(OpenTelemetry otel) {
        this.tracer = otel.getTracer(MessagingSpanHelper.class.getName(), "1.0");
    }

    /**
     * Runs {@code action} inside a span named {@code messaging.dispatch}.
     * Sets ERROR status on exception (rethrows). Sets attributes before the call.
     *
     * @param channel    channel string (EMAIL / SMS / WHATSAPP)
     * @param messageId  UUID of the MessageEntity
     * @param recipient  raw recipient — hashed before attaching to span
     * @param action     the actual gateway dispatch
     * @param <T>        return type of action
     * @return the result of action
     */
    public <T> T dispatchWithSpan(String channel, UUID messageId, String recipient,
                                   Supplier<T> action) {
        Span span = tracer.spanBuilder("messaging.dispatch")
                .setAttribute(CHANNEL, channel)
                .setAttribute(MESSAGE_ID, messageId != null ? messageId.toString() : "null")
                .setAttribute(RECIPIENT_HASH, RecipientHashUtil.hashFirst8Hex(recipient))
                .startSpan();
        try (Scope ignored = span.makeCurrent()) {
            T result = action.get();
            span.setStatus(StatusCode.OK);
            return result;
        } catch (Exception e) {
            span.setStatus(StatusCode.ERROR, e.getMessage());
            throw e;
        } finally {
            span.end();
        }
    }
}
