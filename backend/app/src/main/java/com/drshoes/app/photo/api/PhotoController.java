package com.drshoes.app.photo.api;

import jakarta.validation.Valid;
import com.drshoes.app.auth.principal.AdminPrincipal;
import com.drshoes.app.photo.domain.PhotoLabel;
import com.drshoes.app.photo.domain.PhotoRepository;
import com.drshoes.app.photo.dto.PhotoDto;
import com.drshoes.app.photo.dto.RelabelPhotoRequest;
import com.drshoes.app.photo.service.PhotoNotFoundException;
import com.drshoes.app.photo.service.PhotoService;
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
@RestController
@PreAuthorize("hasAnyRole('OWNER','EMPLOYEE')")
@Slf4j
@RequiredArgsConstructor
public class PhotoController {

    private final PhotoService photos;
    private final PhotoRepository photoRepository;

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

    @GetMapping("/api/admin/orders/{orderId}/photos")
    public List<PhotoDto> list(
            @PathVariable UUID orderId,
            @AuthenticationPrincipal AdminPrincipal actor) {
        log.info("op=photo.list orderId={} actorId={}", orderId, actor.userId());
        return photos.listForOrder(orderId).stream().map(PhotoDto::from).toList();
    }

    @GetMapping("/api/admin/photos/{id}/file")
    public ResponseEntity<InputStreamResource> file(
            @PathVariable UUID id,
            @AuthenticationPrincipal AdminPrincipal actor) {
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

    @PatchMapping("/api/admin/photos/{id}")
    public PhotoDto relabel(
            @PathVariable UUID id,
            @Valid @RequestBody RelabelPhotoRequest req,
            @AuthenticationPrincipal AdminPrincipal actor) {
        log.info("op=photo.relabel.recv photoId={} actorId={} newLabel={}", id, actor.userId(), req.label());
        var photo = photoRepository.findById(id)
            .orElseThrow(() -> new PhotoNotFoundException(id));
        return PhotoDto.from(photos.relabel(photo.getOrderId(), id, req.label(), actor.userId()));
    }

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

}
