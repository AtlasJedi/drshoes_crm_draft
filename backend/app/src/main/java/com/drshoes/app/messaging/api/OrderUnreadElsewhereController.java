package com.drshoes.app.messaging.api;

import com.drshoes.app.auth.principal.AdminPrincipal;
import com.drshoes.app.messaging.dto.UnreadElsewhereDto;
import com.drshoes.app.messaging.repository.MessageThreadRepository;
import com.drshoes.app.order.domain.Order;
import com.drshoes.app.order.domain.OrderRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Comparator;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import lombok.RequiredArgsConstructor;
@RestController
@RequestMapping("/api/admin/orders")
@PreAuthorize("hasAnyRole('OWNER','EMPLOYEE')")
@Slf4j
@RequiredArgsConstructor
public class OrderUnreadElsewhereController {

    private final OrderRepository orders;
    private final MessageThreadRepository threads;

    @GetMapping("/{orderId}/unread-elsewhere")
    public UnreadElsewhereDto unreadElsewhere(
            @PathVariable UUID orderId,
            @AuthenticationPrincipal AdminPrincipal actor) {
        log.info("op=order.unreadElsewhere actor={} orderId={}", actor.email(), orderId);

        Order order = orders.findById(orderId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));

        if (order.getClientId() == null) {
            log.info("op=order.unreadElsewhere actor={} orderId={} outcome=no_client", actor.email(), orderId);
            return new UnreadElsewhereDto(0, null);
        }
        var unreadThread = threads
            .findAllByClientIdAndUnreadCountGreaterThan(order.getClientId(), 0)
            .stream()
            .max(Comparator.comparing(t -> t.getLastMessageAt() == null
                ? java.time.OffsetDateTime.MIN : t.getLastMessageAt()))
            .orElse(null);

        if (unreadThread == null) {
            log.info("op=order.unreadElsewhere actor={} orderId={} outcome=none", actor.email(), orderId);
            return new UnreadElsewhereDto(0, null);
        }

        log.info("op=order.unreadElsewhere actor={} orderId={} threadId={} count={} outcome=ok",
            actor.email(), orderId, unreadThread.getId(), unreadThread.getUnreadCount());
        return new UnreadElsewhereDto(unreadThread.getUnreadCount(), unreadThread.getId());
    }
}
