package com.drshoes.app.messaging.service;

import com.drshoes.app.messaging.domain.TriggerEntity;
import com.drshoes.app.messaging.domain.TriggerEvent;
import com.drshoes.app.messaging.repository.TriggerRepository;
import com.drshoes.app.order.domain.OrderRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

/**
 * Cron-based trigger executor for time-relative messaging triggers.
 *
 * Two scheduled methods:
 *   - runBeforePickup()  09:00 Warsaw — BEFORE_PICKUP_X_DAYS triggers
 *   - runAfterHandover() 11:00 Warsaw — AFTER_HANDOVER_Y_DAYS triggers
 *
 * Idempotency is delegated to TriggerEngine.fireScheduled which guards via IdempotencyService.
 * Discriminators: "before:<targetDate>" and "after:<handoverDate>".
 *
 * Logging contract:
 *   op=scheduled_trigger.run kind=BEFORE_PICKUP date={}  — INFO per run
 *   op=scheduled_trigger.run kind=AFTER_HANDOVER date={} — INFO per run
 */
@Component
public class ScheduledTriggerJob {

    private static final Logger log = LoggerFactory.getLogger(ScheduledTriggerJob.class);
    private static final ZoneId PL = ZoneId.of("Europe/Warsaw");

    private final TriggerRepository triggers;
    private final OrderRepository orders;
    private final TriggerEngine engine;
    private final Clock clock;
    private final ObjectMapper json = new ObjectMapper();

    public ScheduledTriggerJob(TriggerRepository triggers, OrderRepository orders,
                               TriggerEngine engine, Clock clock) {
        this.triggers = triggers;
        this.orders = orders;
        this.engine = engine;
        this.clock = clock;
    }

    @Scheduled(cron = "0 0 9 * * *", zone = "Europe/Warsaw")
    public void runBeforePickup() {
        LocalDate now = LocalDate.now(clock.withZone(PL));
        log.info("op=scheduled_trigger.run kind=BEFORE_PICKUP date={}", now);

        List<TriggerEntity> enabled = triggers.findAllByEventAndEnabledTrue(TriggerEvent.BEFORE_PICKUP_X_DAYS);
        for (TriggerEntity trg : enabled) {
            int days = readIntParam(trg, "days", 1);
            LocalDate target = now.plusDays(days);
            orders.findAllByPlannedPickupDate(target)
                  .forEach(o -> engine.fireScheduled(trg, o.getId(), "before:" + target));
        }
    }

    @Scheduled(cron = "0 0 11 * * *", zone = "Europe/Warsaw")
    public void runAfterHandover() {
        LocalDate now = LocalDate.now(clock.withZone(PL));
        log.info("op=scheduled_trigger.run kind=AFTER_HANDOVER date={}", now);

        List<TriggerEntity> enabled = triggers.findAllByEventAndEnabledTrue(TriggerEvent.AFTER_HANDOVER_Y_DAYS);
        for (TriggerEntity trg : enabled) {
            int days = readIntParam(trg, "days", 3);
            LocalDate handoverDate = now.minusDays(days);
            orders.findAllByPickedUpDate(handoverDate)
                  .forEach(o -> engine.fireScheduled(trg, o.getId(), "after:" + handoverDate));
        }
    }

    private int readIntParam(TriggerEntity trg, String name, int fallback) {
        try {
            JsonNode n = json.readTree(trg.getEventParams()).path(name);
            return n.isMissingNode() ? fallback : n.asInt(fallback);
        } catch (Exception e) {
            return fallback;
        }
    }
}
