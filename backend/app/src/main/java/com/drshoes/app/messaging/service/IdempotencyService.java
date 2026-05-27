package com.drshoes.app.messaging.service;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import lombok.RequiredArgsConstructor;
@Service
@Slf4j
@RequiredArgsConstructor
public class IdempotencyService {

    private final JdbcTemplate jdbc;
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean claimTriggerFire(UUID triggerId, UUID orderId, String discriminator) {
        try {
            jdbc.update(
                    "INSERT INTO trigger_fire (trigger_id, order_id, discriminator) VALUES (?::uuid, ?::uuid, ?)",
                    triggerId.toString(), orderId.toString(), discriminator);
            log.info("op=trigger_fire.claim outcome=claimed triggerId={} orderId={} disc={}",
                    triggerId, orderId, discriminator);
            return true;
        } catch (DuplicateKeyException e) {
            log.info("op=trigger_fire.claim outcome=duplicate triggerId={} orderId={} disc={}",
                    triggerId, orderId, discriminator);
            return false;
        }
    }
}
