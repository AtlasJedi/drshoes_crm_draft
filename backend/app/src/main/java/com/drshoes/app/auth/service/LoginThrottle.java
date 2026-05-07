package com.drshoes.app.auth.service;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.TimeMeter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Duration;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

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
public class LoginThrottle {

    private static final Logger log = LoggerFactory.getLogger(LoginThrottle.class);

    private final long capacity;
    private final Duration window;
    private final TimeMeter timeMeter;
    private final ConcurrentMap<String, Bucket> buckets = new ConcurrentHashMap<>();

    /** Production constructor — uses system nanosecond clock. */
    public LoginThrottle(long capacity, Duration window) {
        this(capacity, window, TimeMeter.SYSTEM_NANOTIME);
    }

    /** Test constructor — accepts an injectable clock for deterministic time control. */
    public LoginThrottle(long capacity, Duration window, TimeMeter timeMeter) {
        this.capacity = capacity;
        this.window = window;
        this.timeMeter = timeMeter;
    }

    /**
     * Attempts to consume one token from the bucket keyed by {@code ip}.
     *
     * @param ip client IP address (or any string key)
     * @return {@code true} if the attempt is allowed; {@code false} if throttled
     */
    public boolean tryConsume(String ip) {
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
