package com.drshoes.app.messaging.service;

import com.drshoes.lib.messaging.RecipientHashUtil;
import io.opentelemetry.api.OpenTelemetry;
import io.opentelemetry.api.common.AttributeKey;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.trace.StatusCode;
import io.opentelemetry.api.trace.Tracer;
import io.opentelemetry.context.Scope;

import java.util.UUID;
import java.util.function.Predicate;
import java.util.function.Supplier;
import org.springframework.stereotype.Component;
@Component
public class MessagingSpanHelper {

    static final AttributeKey<String> CHANNEL        = AttributeKey.stringKey("messaging.channel");
    static final AttributeKey<String> MESSAGE_ID     = AttributeKey.stringKey("messaging.message_id");
    static final AttributeKey<String> RECIPIENT_HASH = AttributeKey.stringKey("messaging.recipient_hash");

    private final Tracer tracer;

    public MessagingSpanHelper(OpenTelemetry otel) {
        this.tracer = otel.getTracer("drshoes-messaging");
    }
    public <T> T dispatchWithSpan(String channel, UUID messageId, String recipient,
                                   Supplier<T> action) {
        return dispatchWithSpan(channel, messageId, recipient, action, t -> false);
    }
    public <T> T dispatchWithSpan(String channel, UUID messageId, String recipient,
                                   Supplier<T> action, Predicate<T> softFailurePredicate) {
        Span span = tracer.spanBuilder("messaging.dispatch")
                .setAttribute(CHANNEL, channel)
                .setAttribute(MESSAGE_ID, messageId != null ? messageId.toString() : "null")
                .setAttribute(RECIPIENT_HASH, RecipientHashUtil.hashFirst8Hex(recipient))
                .startSpan();
        try (Scope ignored = span.makeCurrent()) {
            T result = action.get();
            if (softFailurePredicate.test(result)) {
                span.setStatus(StatusCode.ERROR, "soft delivery failure");
            } else {
                span.setStatus(StatusCode.OK);
            }
            return result;
        } catch (Exception e) {
            span.setStatus(StatusCode.ERROR, e.getMessage());
            throw e;
        } finally {
            span.end();
        }
    }
}
