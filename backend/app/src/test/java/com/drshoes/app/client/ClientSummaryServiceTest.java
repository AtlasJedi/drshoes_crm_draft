package com.drshoes.app.client;

import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.messaging.repository.MessageThreadRepository;
import com.drshoes.app.order.domain.OrderRepository;
import com.drshoes.app.order.domain.OrderStatus;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

/**
 * Unit tests for ClientSummaryService.
 *
 * Verifies:
 *  - all 4 summary fields are derived from repository calls
 *  - open order count = total - closed (WYDANE + ANULOWANE)
 *  - missing / soft-deleted client throws ClientNotFoundException
 *  - unreadThreadCount uses the discarded-at-filtered count method
 */
class ClientSummaryServiceTest {

    private final ClientRepository clientRepo    = mock(ClientRepository.class);
    private final OrderRepository  orderRepo     = mock(OrderRepository.class);
    private final MessageThreadRepository threadRepo = mock(MessageThreadRepository.class);

    private final ClientSummaryService svc =
        new ClientSummaryService(clientRepo, orderRepo, threadRepo);

    @Test
    void summaryReturnsCounts() {
        UUID clientId = UUID.randomUUID();
        Client c = new Client();
        c.setId(clientId);
        c.setFirstName("Jan");
        c.setPhone("+48600000001");
        when(clientRepo.findById(clientId)).thenReturn(Optional.of(c));

        Instant lastOrder = Instant.parse("2025-03-15T10:00:00Z");
        when(orderRepo.countByClientIdAndDeletedAtIsNull(clientId)).thenReturn(5L);
        when(orderRepo.countByClientIdAndStatusInAndDeletedAtIsNull(
                eq(clientId), anyList())).thenReturn(2L);
        when(orderRepo.findLastOrderCreatedAtByClientId(clientId))
                .thenReturn(Optional.of(lastOrder));
        when(threadRepo.countByClientIdAndDiscardedAtIsNullAndUnreadCountGreaterThan(
                clientId, 0)).thenReturn(3L);

        var dto = svc.getSummary(clientId);

        assertThat(dto.clientId()).isEqualTo(clientId);
        assertThat(dto.orderCount()).isEqualTo(5);
        assertThat(dto.openOrderCount()).isEqualTo(3); // 5 - 2 closed
        assertThat(dto.lastOrderAt()).isEqualTo(lastOrder);
        assertThat(dto.unreadThreadCount()).isEqualTo(3);
    }

    @Test
    void summaryWithNoOrdersReturnsNullLastOrder() {
        UUID clientId = UUID.randomUUID();
        Client c = new Client();
        c.setId(clientId);
        c.setFirstName("Empty");
        c.setPhone("+48600000002");
        when(clientRepo.findById(clientId)).thenReturn(Optional.of(c));
        when(orderRepo.countByClientIdAndDeletedAtIsNull(clientId)).thenReturn(0L);
        when(orderRepo.countByClientIdAndStatusInAndDeletedAtIsNull(
                eq(clientId), anyList())).thenReturn(0L);
        when(orderRepo.findLastOrderCreatedAtByClientId(clientId))
                .thenReturn(Optional.empty());
        when(threadRepo.countByClientIdAndDiscardedAtIsNullAndUnreadCountGreaterThan(
                clientId, 0)).thenReturn(0L);

        var dto = svc.getSummary(clientId);

        assertThat(dto.orderCount()).isEqualTo(0);
        assertThat(dto.openOrderCount()).isEqualTo(0);
        assertThat(dto.lastOrderAt()).isNull();
        assertThat(dto.unreadThreadCount()).isEqualTo(0);
    }

    @Test
    void summaryThrowsForMissingClient() {
        UUID id = UUID.randomUUID();
        when(clientRepo.findById(id)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> svc.getSummary(id))
            .isInstanceOf(ClientNotFoundException.class);
    }

    @Test
    void summaryThrowsForSoftDeletedClient() {
        UUID id = UUID.randomUUID();
        Client c = new Client();
        c.setId(id);
        c.setFirstName("Gone");
        c.setPhone("+48600000003");
        c.setDeletedAt(Instant.now());
        when(clientRepo.findById(id)).thenReturn(Optional.of(c));
        assertThatThrownBy(() -> svc.getSummary(id))
            .isInstanceOf(ClientNotFoundException.class);
    }
}
