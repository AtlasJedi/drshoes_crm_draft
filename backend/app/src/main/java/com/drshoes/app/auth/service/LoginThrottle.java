package com.drshoes.app.auth.service;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.TimeMeter;

import java.time.Duration;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import lombok.extern.slf4j.Slf4j;

/**
 * Per-IP login throttle backed by Bucket4j in-memory (ConcurrentHashMap).
 *
 * Default production config: 5 attempts per 15-minute window (interval refill).
 * A clock (TimeMeter) can be injected for deterministic testing without Thread.sleep.
 *
 * Structured logging:
 *   - DEBUG: op=loginThrottleCheck key={ip} bucket={remaining} outcome=allowed
 *   - INFO:  op=loginThrottleCheck key={ip} bucket=0 outcome=throttled
 */
@Slf4j
public class LoginThrottle {

    private final long capacity;
    private final Duration window;
    private final TimeMeter timeMeter;
    private final boolean enabled;
    private final ConcurrentMap<String, Bucket> buckets = new ConcurrentHashMap<>();

    /** Production constructor — uses system nanosecond clock; throttle enabled. */
    public LoginThrottle(long capacity, Duration window) {
        this(capacity, window, TimeMeter.SYSTEM_NANOTIME, true);
    }

    /** Test constructor — accepts an injectable clock for deterministic time control. */
    public LoginThrottle(long capacity, Duration window, TimeMeter timeMeter) {
        this(capacity, window, timeMeter, true);
    }

    /** Full constructor — allows disabling the throttle entirely (local/dev). */
    public LoginThrottle(long capacity, Duration window, TimeMeter timeMeter, boolean enabled) {
        this.capacity = capacity;
        this.window = window;
        this.timeMeter = timeMeter;
        this.enabled = enabled;
    }

    /**
     * Attempts to consume one token from the bucket keyed by {@code ip}.
     *
     * @param ip client IP address (or any string key)
     * @return {@code true} if the attempt is allowed; {@code false} if throttled.
     *         When throttle is disabled, always returns {@code true}.
     */
    public boolean tryConsume(String ip) {
        if (!enabled) {
            log.debug("op=loginThrottleCheck key={} outcome=allowed-disabled", ip);
            return true;
        }
        var bucket = buckets.computeIfAbsent(ip, this::newBucket);
        var probe = bucket.tryConsumeAndReturnRemaining(1);
        boolean allowed = probe.isConsumed();
        long remaining = probe.getRemainingTokens();

        if (allowed) {
            log.debug("op=loginThrottleCheck key={} bucket={} outcome=allowed", ip, remaining);
        } else {
            log.info("op=loginThrottleCheck key={} bucket=0 outcome=throttled", ip);
        }
        return allowed;
    }

    private Bucket newBucket(String ignored) {
        return Bucket.builder()
            .addLimit(Bandwidth.builder()
                .capacity(capacity)
                .refillIntervally(capacity, window)
                .build())
            .withCustomTimePrecision(timeMeter)
            .build();
    }
}
