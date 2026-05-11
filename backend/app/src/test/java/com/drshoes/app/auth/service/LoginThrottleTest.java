package com.drshoes.app.auth.service;

import io.github.bucket4j.TimeMeter;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;

class LoginThrottleTest {

    // (a) below-limit calls succeed, (b) above-limit returns false (triggers 429)
    @Test
    void allows_up_to_5_attempts_then_blocks_per_ip() {
        var throttle = new LoginThrottle(5, Duration.ofMinutes(15));
        for (int i = 0; i < 5; i++) {
            assertThat(throttle.tryConsume("1.2.3.4")).isTrue();
        }
        assertThat(throttle.tryConsume("1.2.3.4")).isFalse();
    }

    // Isolation: exhausting one IP bucket does not affect another
    @Test
    void other_ip_unaffected() {
        var throttle = new LoginThrottle(2, Duration.ofMinutes(15));
        throttle.tryConsume("a.b.c.d");
        throttle.tryConsume("a.b.c.d");
        assertThat(throttle.tryConsume("a.b.c.d")).isFalse();
        assertThat(throttle.tryConsume("9.9.9.9")).isTrue();
    }

    // Disabled throttle: tryConsume always returns true, no capacity check
    @Test
    void disabled_throttle_always_allows() {
        var throttle = new LoginThrottle(1, Duration.ofMinutes(15),
                TimeMeter.SYSTEM_NANOTIME, false);
        for (int i = 0; i < 100; i++) {
            assertThat(throttle.tryConsume("9.9.9.9")).isTrue();
        }
    }

    // (c) bucket refills after window — uses injected clock to avoid Thread.sleep
    @Test
    void bucket_refills_after_window_elapses() {
        // Start at t=0 (nanos)
        AtomicLong nanoTime = new AtomicLong(0);
        TimeMeter clock = new TimeMeter() {
            @Override public long currentTimeNanos() { return nanoTime.get(); }
            @Override public boolean isWallClockBased() { return false; }
        };

        Duration window = Duration.ofMinutes(15);
        var throttle = new LoginThrottle(2, window, clock);

        // Exhaust the bucket
        assertThat(throttle.tryConsume("1.1.1.1")).isTrue();
        assertThat(throttle.tryConsume("1.1.1.1")).isTrue();
        assertThat(throttle.tryConsume("1.1.1.1")).isFalse(); // throttled

        // Advance clock past the full window
        nanoTime.set(window.toNanos() + 1);

        // Bucket should be refilled — attempt succeeds again
        assertThat(throttle.tryConsume("1.1.1.1")).isTrue();
    }
}
