package com.drshoes.app.photo.api;

import com.drshoes.app.auth.principal.AdminPrincipal;
import com.drshoes.app.order.OrderNotFoundException;
import com.drshoes.app.photo.domain.PhotoLabel;
import com.drshoes.app.photo.domain.PhotoRepository;
import com.drshoes.app.photo.dto.PhotoDto;
import com.drshoes.app.photo.dto.RelabelPhotoRequest;
import com.drshoes.app.photo.service.OrderItemNotInOrderException;
import com.drshoes.app.photo.service.PhotoNotFoundException;
import com.drshoes.app.photo.service.PhotoService;
import com.drshoes.app.photo.service.PhotoTooLargeException;
import com.drshoes.app.photo.service.UnsupportedPhotoMimeException;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import lombok.RequiredArgsConstructor;

/**
 * REST endpoints for the admin photo gallery.
 *
 * All endpoints require OWNER or EMPLOYEE role. The controller sits at
 * {@code com.drshoes.app.photo.api} so the AuditLogAspect pointcut
 * ({@code execution(public * com.drshoes.app..api..*Controller.*(..))}) fires
 * for every public method.
 *
 * <h2>Endpoints</h2>
 * POST  /api/admin/orders/{orderId}/photos            — multipart upload
 * GET   /api/admin/orders/{orderId}/photos            — list (newest first)
 * GET   /api/admin/photos/{id}/file                   — stream binary
 * PATCH /api/admin/photos/{id}                        — relabel
 * DELETE /api/admin/photos/{id}                       — hard delete
 *
 * <h2>Errors</h2>
 * UnsupportedPhotoMimeException → 400 (Polish message)
 * PhotoTooLargeException        → 413
 * PhotoNotFoundException        → 404
 * OrderNotFoundException        → 404
 * OrderItemNotInOrderException  → 400
 *
 * <h2>Multipart</h2>
 * Max file size and request size configured in application.yaml (20MB / 200MB).
 * Spring Boot defaults are 1MB; we explicitly set them for photo uploads.
 */
@RestController
@PreAuthorize("hasAnyRole('OWNER','EMPLOYEE')")
@Slf4j
@RequiredArgsConstructor
public class PhotoController {

    private final PhotoService photos;
    private final PhotoRepository photoRepository;

    // ── POST /api/admin/orders/{orderId}/photos ───────────────────────────────

    @PostMapping(path = "/api/admin/orders/{orderId}/photos",
                 consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<PhotoDto> upload(
            @PathVariable UUID orderId,
            @RequestParam("file") MultipartFile file,
            @RequestParam("label") PhotoLabel label,
            @RequestParam(value = "orderItemId", required = false) UUID orderItemId,
            @AuthenticationPrincipal AdminPrincipal actor) {
        log.info("op=photo.upload.recv orderId={} actorId={} label={} mime={} size={}",
            orderId, actor.userId(), label, file.getContentType(), file.getSize());
        var saved = photos.upload(orderId, orderItemId, file, label, actor.userId());
        return ResponseEntity.status(201).body(PhotoDto.from(saved));
    }

    // ── GET /api/admin/orders/{orderId}/photos ────────────────────────────────

    @GetMapping("/api/admin/orders/{orderId}/photos")
    public List<PhotoDto> list(
            @PathVariable UUID orderId,
            @AuthenticationPrincipal AdminPrincipal actor) {
        log.info("op=photo.list orderId={} actorId={}", orderId, actor.userId());
        return photos.listForOrder(orderId).stream().map(PhotoDto::from).toList();
    }

    // ── GET /api/admin/photos/{id}/file ───────────────────────────────────────

    @GetMapping("/api/admin/photos/{id}/file")
    public ResponseEntity<InputStreamResource> file(
            @PathVariable UUID id,
            @AuthenticationPrincipal AdminPrincipal actor) {
        // Resolve photo to get its real orderId before delegating — service verifyOwnership
        // expects a consistent orderId; we use the photo's own orderId so the guard passes.
        var photo = photoRepository.findById(id)
            .orElseThrow(() -> new PhotoNotFoundException(id));
        var handle = photos.stream(photo.getOrderId(), id);
        log.info("op=photo.stream photoId={} orderId={} actorId={} mime={}",
            id, photo.getOrderId(), actor.userId(), handle.mime());
        return ResponseEntity.ok()
            .header(HttpHeaders.CACHE_CONTROL, "private, max-age=3600")
            .contentType(MediaType.parseMediaType(handle.mime()))
            .body(new InputStreamResource(handle.inputStream()));
    }

    // ── PATCH /api/admin/photos/{id} ──────────────────────────────────────────

    @PatchMapping("/api/admin/photos/{id}")
    public PhotoDto relabel(
            @PathVariable UUID id,
            @RequestBody RelabelPhotoRequest req,
            @AuthenticationPrincipal AdminPrincipal actor) {
        log.info("op=photo.relabel.recv photoId={} actorId={} newLabel={}", id, actor.userId(), req.label());
        var photo = photoRepository.findById(id)
            .orElseThrow(() -> new PhotoNotFoundException(id));
        return PhotoDto.from(photos.relabel(photo.getOrderId(), id, req.label(), actor.userId()));
    }

    // ── DELETE /api/admin/photos/{id} ─────────────────────────────────────────

    @DeleteMapping("/api/admin/photos/{id}")
    public ResponseEntity<Void> delete(
            @PathVariable UUID id,
            @AuthenticationPrincipal AdminPrincipal actor) {
        log.info("op=photo.delete.recv photoId={} actorId={}", id, actor.userId());
        var photo = photoRepository.findById(id)
            .orElseThrow(() -> new PhotoNotFoundException(id));
        photos.delete(photo.getOrderId(), id, actor.userId());
        return ResponseEntity.noContent().build();
    }

    // ── exception → HTTP status mapping ──────────────────────────────────────

    @ExceptionHandler(UnsupportedPhotoMimeException.class)
    public ResponseEntity<String> handleMime(UnsupportedPhotoMimeException e) {
        log.debug("op=photo.upload.mimeRejected reason={}", e.getMessage());
        return ResponseEntity.badRequest().body("Nieobsługiwany format pliku");
    }

    @ExceptionHandler(PhotoTooLargeException.class)
    public ResponseEntity<String> handleTooLarge(PhotoTooLargeException e) {
        log.debug("op=photo.upload.tooLarge reason={}", e.getMessage());
        return ResponseEntity.status(413).body("Plik jest zbyt duży (max 20MB)");
    }

    @ExceptionHandler(PhotoNotFoundException.class)
    public ResponseEntity<Void> handleNotFound(PhotoNotFoundException e) {
        return ResponseEntity.notFound().build();
    }

    @ExceptionHandler(OrderNotFoundException.class)
    public ResponseEntity<Void> handleOrderNotFound(OrderNotFoundException e) {
        return ResponseEntity.notFound().build();
    }

    @ExceptionHandler(OrderItemNotInOrderException.class)
    public ResponseEntity<String> handleBadItem(OrderItemNotInOrderException e) {
        return ResponseEntity.badRequest().body("OrderItem nie należy do tego zamówienia");
    }
}
