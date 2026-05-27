package com.drshoes.app.auth.service;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.TimeMeter;

import java.time.Duration;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import lombok.extern.slf4j.Slf4j;
@Slf4j
public class LoginThrottle {

    private final long capacity;
    private final Duration window;
    private final TimeMeter timeMeter;
    private final boolean enabled;
    private final ConcurrentMap<String, Bucket> buckets = new ConcurrentHashMap<>();
    public LoginThrottle(long capacity, Duration window) {
        this(capacity, window, TimeMeter.SYSTEM_NANOTIME, true);
    }
    public LoginThrottle(long capacity, Duration window, TimeMeter timeMeter) {
        this(capacity, window, timeMeter, true);
    }
    public LoginThrottle(long capacity, Duration window, TimeMeter timeMeter, boolean enabled) {
        this.capacity = capacity;
        this.window = window;
        this.timeMeter = timeMeter;
        this.enabled = enabled;
    }
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
