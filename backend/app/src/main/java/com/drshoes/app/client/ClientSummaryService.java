package com.drshoes.app.client;

import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.client.dto.ClientSummaryDto;
import com.drshoes.app.messaging.repository.MessageThreadRepository;
import com.drshoes.app.order.domain.OrderRepository;
import com.drshoes.app.order.domain.OrderStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import lombok.RequiredArgsConstructor;
@Service
@Slf4j
@RequiredArgsConstructor
public class ClientSummaryService {
    private static final List<OrderStatus> CLOSED_STATUSES =
        List.of(OrderStatus.WYDANE, OrderStatus.ANULOWANE);

    private final ClientRepository    clientRepo;
    private final OrderRepository     orderRepo;
    private final MessageThreadRepository threadRepo;

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
