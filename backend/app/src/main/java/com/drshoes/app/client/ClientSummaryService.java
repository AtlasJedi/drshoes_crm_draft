package com.drshoes.app.client;

import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.client.dto.ClientSummaryDto;
import com.drshoes.app.messaging.repository.MessageThreadRepository;
import com.drshoes.app.order.domain.OrderRepository;
import com.drshoes.app.order.domain.OrderStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Computes aggregate summary KPIs for a single client.
 *
 * All counts are done in SQL (never in memory).
 * Soft-deleted orders (deleted_at IS NOT NULL) are excluded from all counts.
 * Closed statuses for openOrderCount = WYDANE | ANULOWANE.
 * unreadThreadCount excludes discarded threads.
 */
@Service
public class ClientSummaryService {

    private static final Logger log = LoggerFactory.getLogger(ClientSummaryService.class);

    /** Statuses that represent a "closed" order — excluded from openOrderCount. */
    private static final List<OrderStatus> CLOSED_STATUSES =
        List.of(OrderStatus.WYDANE, OrderStatus.ANULOWANE);

    private final ClientRepository    clientRepo;
    private final OrderRepository     orderRepo;
    private final MessageThreadRepository threadRepo;

    public ClientSummaryService(ClientRepository clientRepo,
                                OrderRepository orderRepo,
                                MessageThreadRepository threadRepo) {
        this.clientRepo = clientRepo;
        this.orderRepo  = orderRepo;
        this.threadRepo = threadRepo;
    }

    @Transactional(readOnly = true)
    public ClientSummaryDto getSummary(UUID clientId) {
        clientRepo.findById(clientId)
            .filter(c -> c.getDeletedAt() == null)
            .orElseThrow(() -> new ClientNotFoundException(clientId));

        long total  = orderRepo.countByClientIdAndDeletedAtIsNull(clientId);
        long closed = orderRepo.countByClientIdAndStatusInAndDeletedAtIsNull(
                          clientId, CLOSED_STATUSES);
        long open   = Math.max(0L, total - closed);
        Instant lastAt = orderRepo.findLastOrderCreatedAtByClientId(clientId).orElse(null);
        long unread = threadRepo.countByClientIdAndDiscardedAtIsNullAndUnreadCountGreaterThan(
                          clientId, 0);

        log.info("op=getClientSummary clientId={} orderCount={} openOrderCount={} unreadThreadCount={} outcome=ok",
            clientId, total, open, unread);
        return new ClientSummaryDto(clientId, (int) total, (int) open, lastAt, (int) unread);
    }
}
