package com.drshoes.app.order;

import com.drshoes.app.AbstractIntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CopyOnWriteArraySet;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration tests for OrderCodeSequence.
 *
 * Uses isolated years (1999 / 1998) that no other test touches so counter
 * isolation is achieved without truncating order_code_counter, which could
 * race with parallel test suites sharing the same Testcontainers Postgres.
 */
class OrderCodeSequenceIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    OrderCodeSequence seq;

    @Autowired
    JdbcTemplate jdbc;

    /** Reset counters for our test years before each test so they start fresh. */
    @BeforeEach
    void resetCounters() {
        jdbc.update("DELETE FROM order_code_counter WHERE year IN (1999, 1998)");
    }

    // ---- 1. first code is DR-1999-0001 ----

    @Test
    void firstCode_isZeroPaddedOne() {
        String code = seq.next(1999);
        assertThat(code).isEqualTo("DR-1999-0001");
    }

    // ---- 2. monotonic within same year ----

    @Test
    void secondCall_incrementsCounter() {
        String first  = seq.next(1999);
        String second = seq.next(1999);
        assertThat(first).isEqualTo("DR-1999-0001");
        assertThat(second).isEqualTo("DR-1999-0002");
    }

    // ---- 3. different years are independent ----

    @Test
    void differentYears_allocateIndependently() {
        seq.next(1999); // 1999 → DR-1999-0001

        String firstOf1998 = seq.next(1998);
        assertThat(firstOf1998).isEqualTo("DR-1998-0001");

        String secondOf1999 = seq.next(1999);
        assertThat(secondOf1999).isEqualTo("DR-1999-0002");
    }

    // ---- 4. concurrency: parallel callers get distinct codes ----

    @Test
    void concurrentCalls_produceDistinctCodes() throws Exception {
        int threads = 8;
        Set<String> codes = new CopyOnWriteArraySet<>();

        CompletableFuture<?>[] futures = IntStream.range(0, threads)
                .mapToObj(i -> CompletableFuture.runAsync(() -> codes.add(seq.next(1999))))
                .toArray(CompletableFuture[]::new);

        CompletableFuture.allOf(futures).get();

        assertThat(codes).hasSize(threads);
    }
}
