package com.drshoes.app.order;

import com.drshoes.app.audit.Audited;
import com.drshoes.app.auth.domain.UserRepository;
import com.drshoes.app.client.ClientNotFoundException;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.messaging.service.TriggerEngine;
import com.drshoes.app.order.domain.*;
import com.drshoes.app.order.dto.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Command + query facade for the Order aggregate root.
 * Mutations: create, update, changeStatus, softDelete, item delegation.
 * Queries (get/list) delegate to repository via {@link OrderSpecifications}.
 * Item mutations delegate to {@link OrderItemService}.
 *
 * Structured logging: op={} orderId={} outcome=ok|not-found|already-deleted|version-conflict
 */
@Service
public class OrderService {

    private static final Logger log = LoggerFactory.getLogger(OrderService.class);

    private final OrderRepository orderRepo;
    private final OrderItemRepository itemRepo;
    private final ClientRepository clientRepo;
    private final OrderCodeSequence codeSeq;
    private final OrderItemService itemService;
    private final TriggerEngine triggerEngine;
    private final UserRepository userRepo;

    public OrderService(OrderRepository orderRepo, OrderItemRepository itemRepo,
                        ClientRepository clientRepo, OrderCodeSequence codeSeq,
                        OrderItemService itemService, TriggerEngine triggerEngine,
                        UserRepository userRepo) {
        this.orderRepo = orderRepo; this.itemRepo = itemRepo;
        this.clientRepo = clientRepo; this.codeSeq = codeSeq;
        this.itemService = itemService; this.triggerEngine = triggerEngine;
        this.userRepo = userRepo;
    }

    // ---- queries ----

    @Transactional(readOnly = true)
    public OrderDto get(UUID id) {
        Order o = orderRepo.findById(id)
            .filter(x -> x.getDeletedAt() == null)
            .orElseThrow(() -> new OrderNotFoundException(id));
        return toDto(o);
    }

    @Transactional(readOnly = true)
    public Page<OrderListRow> list(List<OrderStatus> statuses, UUID assigneeId,
                                   List<OrderItemKind> kinds, String q,
                                   String tag, Instant plannedPickupAtFrom,
                                   Instant plannedPickupAtTo, UUID clientId,
                                   Pageable pageable) {
        var page = orderRepo.findAll(
            OrderSpecifications.forList(statuses, assigneeId, kinds, q, tag,
                                        plannedPickupAtFrom, plannedPickupAtTo, clientId),
            pageable);
        Set<UUID> cids = page.map(Order::getClientId).toSet();
        Map<UUID, String> names = clientRepo.findAllById(cids).stream()
            .collect(Collectors.toMap(c -> c.getId(), c -> c.getFullName()));
        return page.map(o -> OrderListRow.of(o, names.getOrDefault(o.getClientId(), "—")));
    }

    // ---- commands ----

    @Transactional
    public OrderDto create(CreateOrderRequest req) {
        if (clientRepo.findById(req.clientId()).filter(c -> c.getDeletedAt() == null).isEmpty())
            throw new ClientNotFoundException(req.clientId());
        Order o = new Order();
        o.setCode(codeSeq.next());
        o.setClientId(req.clientId());
        o.setStatus(OrderStatus.PRZYJETE);
        o.setSource(req.source() != null ? req.source() : OrderSource.ADMIN);
        o.setDescription(req.description());
        o.setReceivedAt(req.receivedAt() != null ? req.receivedAt() : Instant.now());
        o.setPlannedPickupAt(req.plannedPickupAt());
        o.setAssignedCraftsmanId(req.assignedCraftsmanId());
        o.setQuotedPriceCents(req.quotedPriceCents() != null ? req.quotedPriceCents() : 0);
        o.setAdvancePaidCents(req.advancePaidCents() != null ? req.advancePaidCents() : 0);
        Order saved = orderRepo.save(o);
        UUID savedId = saved.getId();
        if (req.items() != null) {
            req.items().forEach(ir -> itemService.addItem(savedId, ir));
            saved = orderRepo.findById(savedId).orElseThrow();
        }
        log.info("op=createOrder orderId={} code={} clientId={} outcome=ok",
            saved.getId(), saved.getCode(), saved.getClientId());
        triggerEngine.onStatusChange(saved.getId(), null, OrderStatus.PRZYJETE.name());
        log.info("op=create.triggerFire orderId={} outcome=enqueued", saved.getId());
        return toDto(saved);
    }

    @Transactional
    public OrderDto update(UUID id, UpdateOrderRequest req) {
        Order o = orderRepo.findById(id).orElseThrow(() -> new OrderNotFoundException(id));
        if (o.getDeletedAt() != null) throw new OrderAlreadyDeletedException(id);
        if (req.version() != null && req.version() != o.getVersion())
            throw new OrderVersionConflictException(id, o.getVersion());

        // M10 hygiene: compute Polish diff BEFORE applying changes
        String diffNote = OrderUpdateDiff.computePolish(o, req, this::resolveUserName);

        if (req.description() != null)              o.setDescription(req.description());
        if (req.plannedPickupAt() != null)          o.setPlannedPickupAt(req.plannedPickupAt());
        if (req.assignedCraftsmanId() != null)      o.setAssignedCraftsmanId(req.assignedCraftsmanId());
        if (req.currentStorageLocationId() != null) o.setCurrentStorageLocationId(req.currentStorageLocationId());
        if (req.cancelledReason() != null)          o.setCancelledReason(req.cancelledReason());
        if (req.tags() != null)                     o.setTags(req.tags());
        if (req.quotedPriceCents() != null)         o.setQuotedPriceCents(req.quotedPriceCents());
        if (req.advancePaidCents() != null)         o.setAdvancePaidCents(req.advancePaidCents());

        // Inject diff into request attribute for AuditLogAspect to pick up
        if (diffNote != null) {
            try {
                ServletRequestAttributes attrs =
                    (ServletRequestAttributes) RequestContextHolder.currentRequestAttributes();
                attrs.getRequest().setAttribute("audit.diffNote", diffNote);
            } catch (IllegalStateException ignored) {
                // no request bound (e.g., called from test) — drop silently
            }
        }

        log.info("op=updateOrder orderId={} hasDiff={} outcome=ok", id, diffNote != null);
        return toDto(orderRepo.save(o));
    }

    private String resolveUserName(UUID userId) {
        if (userId == null) return null;
        return userRepo.findById(userId).map(u -> u.getFullName()).orElse("?");
    }

    @Transactional
    public ChangeStatusResponse changeStatus(UUID id, ChangeStatusRequest req) {
        Order o = orderRepo.findById(id)
            .filter(x -> x.getDeletedAt() == null)
            .orElseThrow(() -> new OrderNotFoundException(id));
        if (o.getVersion() != req.expectedVersion())
            throw new OrderVersionConflictException(id, o.getVersion());
        OrderStatus old = o.getStatus();
        o.setStatus(req.targetStatus());
        if (req.targetStatus() == OrderStatus.PRZYJETE && o.getReceivedAt() == null)
            o.setReceivedAt(Instant.now());
        if (req.targetStatus() == OrderStatus.WYDANE && o.getPickedUpAt() == null)
            o.setPickedUpAt(Instant.now());
        Order saved = orderRepo.save(o);
        log.info("op=changeOrderStatus orderId={} fromStatus={} toStatus={} sendTriggers={} noteLen={} outcome=ok",
            id, old, req.targetStatus(), req.sendTriggers(),
            req.note() != null ? req.note().length() : 0);
        if (Boolean.TRUE.equals(req.sendTriggers())) {
            triggerEngine.onStatusChange(saved.getId(), old.name(), req.targetStatus().name());
        }
        return new ChangeStatusResponse(toDto(saved), new TriggerSuggestion());
    }

    @Transactional
    public void softDelete(UUID id) {
        Order o = orderRepo.findById(id).orElseThrow(() -> new OrderNotFoundException(id));
        if (o.getDeletedAt() != null) { log.info("op=softDeleteOrder orderId={} outcome=already-deleted", id); return; }
        o.setDeletedAt(Instant.now());
        orderRepo.save(o);
        log.info("op=softDeleteOrder orderId={} outcome=ok", id);
    }

    // ---- item delegation ----

    @Audited(parent = "#orderId")
    @Transactional
    public OrderItemDto addItem(UUID orderId, CreateOrderItemRequest req) {
        ensureOrderActive(orderId);
        return itemService.addItem(orderId, req);
    }

    @Audited(parent = "#orderId")
    @Transactional
    public OrderItemDto updateItem(UUID orderId, UUID itemId, UpdateOrderItemRequest req) {
        ensureOrderActive(orderId);
        return itemService.updateItem(orderId, itemId, req);
    }

    @Audited(parent = "#orderId")
    @Transactional
    public void removeItem(UUID orderId, UUID itemId) {
        ensureOrderActive(orderId);
        itemService.removeItem(orderId, itemId);
    }

    // ---- private helpers ----

    private void ensureOrderActive(UUID orderId) {
        orderRepo.findById(orderId)
            .filter(x -> x.getDeletedAt() == null)
            .orElseThrow(() -> new OrderNotFoundException(orderId));
    }

    private OrderDto toDto(Order o) {
        List<OrderItemDto> items = itemRepo.findAllByOrderIdOrderByPosition(o.getId())
            .stream().map(OrderItemDto::of).toList();
        String clientName = clientRepo.findById(o.getClientId())
            .map(c -> c.getFullName()).orElse("—");
        return OrderDto.of(o, items, clientName);
    }
}
