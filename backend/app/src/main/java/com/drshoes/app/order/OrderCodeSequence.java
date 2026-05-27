package com.drshoes.app.order;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Year;
import lombok.extern.slf4j.Slf4j;
import lombok.RequiredArgsConstructor;
@Service
@Slf4j
@RequiredArgsConstructor
public class OrderCodeSequence {

    private final JdbcTemplate jdbc;
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public String next(int year) {
        String code = jdbc.queryForObject("SELECT next_order_code(?)", String.class, year);
        log.info("op=allocateOrderCode year={} code={} outcome=ok", year, code);
        return code;
    }
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public String next() {
        return next(Year.now().getValue());
    }
}
