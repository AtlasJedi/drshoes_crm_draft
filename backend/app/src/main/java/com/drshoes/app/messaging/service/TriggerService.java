package com.drshoes.app.messaging.service;

import com.drshoes.app.audit.Audited;
import com.drshoes.app.messaging.domain.TriggerEntity;
import com.drshoes.app.messaging.dto.TriggerDto;
import com.drshoes.app.messaging.repository.MessageTemplateRepository;
import com.drshoes.app.messaging.repository.TriggerRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

/**
 * Service for automation trigger management.
 *
 * Only list, get, and setEnabled are exposed (full editor deferred to M3).
 * Structured logging: op=trigger.toggle outcome=ok id={} enabled={}
 */
@Service
public class TriggerService {

    private static final Logger log = LoggerFactory.getLogger(TriggerService.class);

    private final TriggerRepository triggers;
    private final MessageTemplateRepository templates;

    public TriggerService(TriggerRepository triggers, MessageTemplateRepository templates) {
        this.triggers = triggers;
        this.templates = templates;
    }

    public List<TriggerDto> list() {
        return triggers.findAllByOrderByNameAsc().stream().map(this::toDto).toList();
    }

    public TriggerDto get(UUID id) {
        return toDto(triggers.findById(id).orElseThrow(
            () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Trigger not found")));
    }

    @Audited
    @Transactional
    public TriggerDto setEnabled(UUID id, boolean enabled) {
        var t = triggers.findById(id).orElseThrow(
            () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Trigger not found"));
        t.setEnabled(enabled);
        var saved = triggers.save(t);
        log.info("op=trigger.toggle outcome=ok id={} enabled={}", id, enabled);
        return toDto(saved);
    }

    // ---- helpers ----

    private TriggerDto toDto(TriggerEntity t) {
        String templateName = t.getTemplateId() == null ? null
            : templates.findById(t.getTemplateId()).map(x -> x.getName()).orElse(null);
        return new TriggerDto(
            t.getId(), t.getName(), t.getEnabled(),
            t.getEvent().name(), t.getEventParams(), t.getChannels(),
            t.getTemplateId(), templateName,
            t.getDelayMinutes(), t.isRequiresManualConfirmation(),
            t.getCreatedAt(), t.getUpdatedAt());
    }
}
