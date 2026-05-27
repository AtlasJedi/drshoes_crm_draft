package com.drshoes.app.order;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Year;
import lombok.extern.slf4j.Slf4j;
import lombok.RequiredArgsConstructor;

/**
 * Allocates the next human-readable order code in the form {@code DR-YYYY-NNNN}.
 *
 * <p>Thin Spring wrapper around the {@code next_order_code(p_year INT)} PL/pgSQL function
 * defined in V001__init.sql. The function uses an {@code INSERT … ON CONFLICT DO UPDATE}
 * pattern that is atomic and safe for concurrent callers.
 *
 * <p>REQUIRES_NEW propagation ensures the sequence counter is committed independently
 * of any outer transaction that may later roll back — preventing code gaps in the
 * counter while still guaranteeing uniqueness.
 *
 * <p>Structured logging per dispatch-protocol §7:
 *   {@code op=allocateOrderCode year={} code={} outcome=ok}
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class OrderCodeSequence {

    private final JdbcTemplate jdbc;

    /**
     * Allocates the next code for the given calendar year.
     * Runs in its own transaction so the counter increment is never rolled back.
     *
     * @param year four-digit calendar year (e.g. {@code 2025})
     * @return a code such as {@code DR-2025-0001}
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public String next(int year) {
        String code = jdbc.queryForObject("SELECT next_order_code(?)", String.class, year);
        log.info("op=allocateOrderCode year={} code={} outcome=ok", year, code);
        return code;
    }

    /**
     * Convenience overload that uses the current calendar year.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public String next() {
        return next(Year.now().getValue());
    }
}
