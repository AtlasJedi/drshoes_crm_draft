package com.drshoes.app.messaging.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Idempotency guard for trigger firings.
 *
 * Inserts a (trigger_id, order_id, discriminator) row into trigger_fire via a native
 * JDBC INSERT. On duplicate PK Postgres raises unique_violation; Spring wraps it as
 * DuplicateKeyException (a DataIntegrityViolationException subtype) — caught and
 * reported as false.
 *
 * Uses JdbcTemplate rather than JPA to guarantee a true INSERT on every invocation,
 * bypassing the Hibernate first-level cache which would otherwise silently skip the
 * second persist() call for an entity already known to the session.
 *
 * REQUIRES_NEW ensures a uniqueness conflict cannot poison the caller's transaction.
 */
@Service
public class IdempotencyService {

    private static final Logger log = LoggerFactory.getLogger(IdempotencyService.class);

    private final JdbcTemplate jdbc;

    public IdempotencyService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Claims a (triggerId, orderId, discriminator) tuple for one-time firing.
     *
     * @return true on first successful claim; false if already claimed (duplicate).
     */
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
