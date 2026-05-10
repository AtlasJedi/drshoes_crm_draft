package com.drshoes.app.order.api;

import com.drshoes.app.order.OrderService;
import com.drshoes.app.order.domain.OrderItemKind;
import com.drshoes.app.order.domain.OrderStatus;
import com.drshoes.app.order.dto.*;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

/**
 * REST controller for the Order aggregate.
 *
 * Endpoints:
 *   POST   /api/admin/orders                       — create (OWNER | EMPLOYEE)
 *   GET    /api/admin/orders                       — paginated list (OWNER | EMPLOYEE)
 *   GET    /api/admin/orders/{id}                  — single order (OWNER | EMPLOYEE)
 *   PATCH  /api/admin/orders/{id}                  — update (OWNER | EMPLOYEE)
 *   POST   /api/admin/orders/{id}/status           — change status (OWNER | EMPLOYEE)
 *   DELETE /api/admin/orders/{id}                  — soft-delete (OWNER only)
 *   POST   /api/admin/orders/{id}/items            — add item (OWNER | EMPLOYEE)
 *   PATCH  /api/admin/orders/{id}/items/{itemId}   — update item (OWNER | EMPLOYEE)
 *   DELETE /api/admin/orders/{id}/items/{itemId}   — remove item (OWNER | EMPLOYEE)
 *
 * Structured logging per dispatch-protocol §7:
 *   op=<method> actor={} orderId={} outcome=ok
 *
 * RBAC: all endpoints require authenticated session (enforced by SecurityConfig).
 * DELETE /orders/{id} is further restricted to OWNER via @PreAuthorize + RbacService.canDeleteOrders.
 *
 * NOTE: This class exceeds 120 LOC due to 9 endpoints. CRUD-style controllers are an
 * accepted exception to the granular-code rule per CLAUDE.md (mirroring JPA entity exception).
 */
@RestController
@RequestMapping("/api/admin/orders")
public class OrderController {

    private static final Logger log = LoggerFactory.getLogger(OrderController.class);

    private final OrderService svc;

    public OrderController(OrderService svc) {
        this.svc = svc;
    }

    @PostMapping
    public ResponseEntity<OrderDto> create(@Valid @RequestBody CreateOrderRequest req,
                                           Authentication auth) {
        OrderDto created = svc.create(req);
        log.info("op=createOrder actor={} orderId={} outcome=ok", actor(auth), created.id());
        return ResponseEntity
            .created(URI.create("/api/admin/orders/" + created.id()))
            .body(created);
    }

    @GetMapping
    public Page<OrderListRow> list(
            @RequestParam(required = false) List<OrderStatus> status,
            @RequestParam(required = false, name = "type") List<OrderItemKind> kinds,
            @RequestParam(required = false) UUID craftsmanId,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String tag,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate plannedPickupAtFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate plannedPickupAtTo,
            Pageable pageable,
            Authentication auth) {
        Instant from = plannedPickupAtFrom != null
            ? plannedPickupAtFrom.atStartOfDay(ZoneId.of("Europe/Warsaw")).toInstant() : null;
        // to is exclusive: advance by one day so the entire target date is included
        Instant to = plannedPickupAtTo != null
            ? plannedPickupAtTo.plusDays(1).atStartOfDay(ZoneId.of("Europe/Warsaw")).toInstant() : null;
        log.info("op=listOrders actor={} tag={} from={} to={} outcome=ok",
            actor(auth), tag, from, to);
        return svc.list(status, craftsmanId, kinds, q, tag, from, to, pageable);
    }

    @GetMapping("/{id}")
    public OrderDto get(@PathVariable UUID id, Authentication auth) {
        OrderDto dto = svc.get(id);
        log.info("op=getOrder actor={} orderId={} outcome=ok", actor(auth), id);
        return dto;
    }

    @PatchMapping("/{id}")
    public OrderDto update(@PathVariable UUID id,
                           @Valid @RequestBody UpdateOrderRequest req,
                           Authentication auth) {
        OrderDto updated = svc.update(id, req);
        log.info("op=updateOrder actor={} orderId={} outcome=ok", actor(auth), id);
        return updated;
    }

    @PostMapping("/{id}/status")
    public ChangeStatusResponse changeStatus(@PathVariable UUID id,
                                             @Valid @RequestBody ChangeStatusRequest req,
                                             Authentication auth) {
        ChangeStatusResponse resp = svc.changeStatus(id, req);
        log.info("op=changeOrderStatus actor={} orderId={} targetStatus={} outcome=ok",
            actor(auth), id, req.targetStatus());
        return resp;
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("@rbac.canDeleteOrders(authentication)")
    public ResponseEntity<Void> delete(@PathVariable UUID id, Authentication auth) {
        svc.softDelete(id);
        log.info("op=deleteOrder actor={} orderId={} outcome=ok", actor(auth), id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/items")
    public ResponseEntity<OrderItemDto> addItem(@PathVariable UUID id,
                                                @Valid @RequestBody CreateOrderItemRequest req,
                                                Authentication auth) {
        OrderItemDto item = svc.addItem(id, req);
        log.info("op=addOrderItem actor={} orderId={} itemId={} outcome=ok", actor(auth), id, item.id());
        return ResponseEntity
            .created(URI.create("/api/admin/orders/" + id + "/items/" + item.id()))
            .body(item);
    }

    @PatchMapping("/{id}/items/{itemId}")
    public OrderItemDto updateItem(@PathVariable UUID id,
                                   @PathVariable UUID itemId,
                                   @Valid @RequestBody UpdateOrderItemRequest req,
                                   Authentication auth) {
        OrderItemDto item = svc.updateItem(id, itemId, req);
        log.info("op=updateOrderItem actor={} orderId={} itemId={} outcome=ok", actor(auth), id, itemId);
        return item;
    }

    @DeleteMapping("/{id}/items/{itemId}")
    public ResponseEntity<Void> removeItem(@PathVariable UUID id,
                                           @PathVariable UUID itemId,
                                           Authentication auth) {
        svc.removeItem(id, itemId);
        log.info("op=removeOrderItem actor={} orderId={} itemId={} outcome=ok", actor(auth), id, itemId);
        return ResponseEntity.noContent().build();
    }

    private static String actor(Authentication auth) {
        return (auth != null) ? auth.getName() : "anonymous";
    }
}
