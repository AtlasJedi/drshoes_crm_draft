package com.drshoes.app.messaging.service;

import com.drshoes.app.audit.Audited;
import com.drshoes.app.messaging.domain.MessageTemplateEntity;
import com.drshoes.app.messaging.dto.CreateTemplateRequest;
import com.drshoes.app.messaging.dto.TemplateDto;
import com.drshoes.app.messaging.dto.UpdateTemplateRequest;
import com.drshoes.app.messaging.repository.MessageTemplateRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

/**
 * CRUD service for message_template.
 *
 * Soft-delete: sets active=false; rows are never physically removed (history preserved).
 * Duplicate name: rejects with 409 CONFLICT.
 *
 * Structured logging: op=template.{create,update,delete} outcome=ok name={}
 */
@Service
public class TemplateService {

    private static final Logger log = LoggerFactory.getLogger(TemplateService.class);

    private final MessageTemplateRepository repo;

    public TemplateService(MessageTemplateRepository repo) {
        this.repo = repo;
    }

    public List<TemplateDto> list() {
        return repo.findAll().stream().map(this::toDto).toList();
    }

    public TemplateDto get(UUID id) {
        return toDto(findOrThrow(id));
    }

    @Audited
    @Transactional
    public TemplateDto create(CreateTemplateRequest req) {
        repo.findByName(req.name()).ifPresent(t -> {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Template name already exists");
        });
        var e = new MessageTemplateEntity();
        e.setName(req.name());
        e.setChannel(req.channel());
        e.setSubject(req.subject());
        e.setBody(req.body());
        e.setActive(req.active() != null ? req.active() : Boolean.TRUE);
        var saved = repo.save(e);
        log.info("op=template.create outcome=ok name={}", saved.getName());
        return toDto(saved);
    }

    @Audited
    @Transactional
    public TemplateDto update(UUID id, UpdateTemplateRequest req) {
        var e = findOrThrow(id);
        if (req.name() != null)    e.setName(req.name());
        if (req.channel() != null) e.setChannel(req.channel());
        if (req.subject() != null) e.setSubject(req.subject());
        if (req.body() != null)    e.setBody(req.body());
        if (req.active() != null)  e.setActive(req.active());
        var saved = repo.save(e);
        log.info("op=template.update outcome=ok name={}", saved.getName());
        return toDto(saved);
    }

    @Audited
    @Transactional
    public void softDelete(UUID id) {
        var e = findOrThrow(id);
        e.setActive(false);
        repo.save(e);
        log.info("op=template.delete outcome=ok name={}", e.getName());
    }

    // ---- helpers ----

    private MessageTemplateEntity findOrThrow(UUID id) {
        return repo.findById(id).orElseThrow(
            () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Template not found"));
    }

    private TemplateDto toDto(MessageTemplateEntity e) {
        return new TemplateDto(
            e.getId(), e.getName(), e.getChannel(), e.getSubject(),
            e.getBody(), e.getActive(), e.getCreatedAt(), e.getUpdatedAt());
    }
}
