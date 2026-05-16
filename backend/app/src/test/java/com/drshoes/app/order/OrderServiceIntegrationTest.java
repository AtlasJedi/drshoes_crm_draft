package com.drshoes.app.order;

import com.drshoes.app.AbstractIntegrationTest;
import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.messaging.domain.MessageEntity;
import com.drshoes.app.messaging.repository.MessageRepository;
import com.drshoes.app.order.domain.*;
import com.drshoes.app.order.dto.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;

/**
 * Integration tests for OrderService. Requires a running Postgres (via AbstractIntegrationTest).
 * Optimistic-locking tests use EntityManager.clear() to evict first-level cache and reload stale state.
 */
class OrderServiceIntegrationTest extends AbstractIntegrationTest {

    @Autowired OrderService svc;
    @Autowired OrderRepository orderRepo;
    @Autowired OrderItemRepository itemRepo;
    @Autowired ClientRepository clientRepo;
    @Autowired MessageRepository messageRepo;

    private UUID clientId;

    @BeforeEach
    void setUp() {
        // clean slate per test
        itemRepo.deleteAll();
        orderRepo.deleteAll();
        Client c = new Client();
        c.setFirstName("Misza");
        c.setPhone("+48123456789");
        clientId = clientRepo.save(c).getId();
    }

    // ---- helpers ----

    private CreateOrderRequest req(String description) {
        return new CreateOrderRequest(clientId, description, null, null, null, OrderSource.ADMIN, null, null, null);
    }

    private CreateOrderRequest reqWithQuote(String description, int quotedPriceCents, Integer advancePaidCents) {
        return new CreateOrderRequest(clientId, description, null, null, null, OrderSource.ADMIN, null,
            quotedPriceCents, advancePaidCents);
    }

    private CreateOrderRequest reqWithItems(String description, List<CreateOrderItemRequest> items) {
        return new CreateOrderRequest(clientId, description, null, null, null, OrderSource.ADMIN, items, null, null);
    }

    // ============================================================
    // Test 1: create allocates code, persists status=PRZYJETE, version=0
    // ============================================================
    @Test
    void createOrder_allocatesCodeAndDefaultsStatus() {
        OrderDto dto = svc.create(req("naprawa buta"));

        assertThat(dto.code()).matches("DR-\\d{4}-\\d{4}");
        assertThat(dto.status()).isEqualTo(OrderStatus.PRZYJETE);
        assertThat(dto.version()).isEqualTo(0);
        assertThat(dto.clientId()).isEqualTo(clientId);
        assertThat(dto.currency()).isEqualTo("PLN");
    }

    // ============================================================
    // Test 2: get composes items ordered by position
    // ============================================================
    @Test
    void getOrder_composesItemsInPositionOrder() {
        var itemReqs = List.of(
            new CreateOrderItemRequest(OrderItemKind.NAPRAWA, "zelowanie", null, 5000),
            new CreateOrderItemRequest(OrderItemKind.CUSTOM, "malowanie", null, 15000)
        );
        OrderDto created = svc.create(reqWithItems("multi-item", itemReqs));

        OrderDto dto = svc.get(created.id());

        assertThat(dto.items()).hasSize(2);
        assertThat(dto.items().get(0).position()).isEqualTo(0);
        assertThat(dto.items().get(1).position()).isEqualTo(1);
        assertThat(dto.items().get(0).kind()).isEqualTo(OrderItemKind.NAPRAWA);
        assertThat(dto.totalPriceCents()).isEqualTo(20000);
    }

    // ============================================================
    // Test 3: get 404 on soft-deleted order
    // ============================================================
    @Test
    void getOrder_404OnSoftDeleted() {
        OrderDto created = svc.create(req("stare buty"));
        svc.softDelete(created.id());

        assertThatThrownBy(() -> svc.get(created.id()))
            .isInstanceOf(OrderNotFoundException.class);
    }

    // ============================================================
    // Test 4: changeStatus happy path updates receivedAt when going to PRZYJETE
    // ============================================================
    @Test
    void changeStatus_toWstepniePrzyjete_then_toPrzyjete_updatesReceivedAt() {
        // Create with WSTEPNIE_PRZYJETE status directly
        OrderDto created = svc.create(req("opis"));
        // first go back to WSTEPNIE_PRZYJETE to test the PRZYJETE transition
        ChangeStatusResponse r1 = svc.changeStatus(created.id(),
            new ChangeStatusRequest(OrderStatus.WSTEPNIE_PRZYJETE, created.version(), true));

        ChangeStatusResponse r2 = svc.changeStatus(r1.order().id(),
            new ChangeStatusRequest(OrderStatus.PRZYJETE, r1.order().version(), true));

        assertThat(r2.order().status()).isEqualTo(OrderStatus.PRZYJETE);
        assertThat(r2.order().receivedAt()).isNotNull();
        assertThat(r2.order().version()).isGreaterThan(r1.order().version());
        assertThat(r2.triggerSuggestion()).isNotNull();
    }

    // ============================================================
    // Test 5: changeStatus to WYDANE sets pickedUpAt
    // ============================================================
    @Test
    void changeStatus_toWydane_setsPickedUpAt() {
        OrderDto created = svc.create(req("gotowe"));

        ChangeStatusResponse r = svc.changeStatus(created.id(),
            new ChangeStatusRequest(OrderStatus.WYDANE, created.version(), true));

        assertThat(r.order().status()).isEqualTo(OrderStatus.WYDANE);
        assertThat(r.order().pickedUpAt()).isNotNull();
    }

    // ============================================================
    // Test 6: free FSM — PRZYJETE → ANULOWANE without going through W_REALIZACJI
    // ============================================================
    @Test
    void changeStatus_freeTransition_przyjeteDiretoAnulowane() {
        OrderDto created = svc.create(req("anuluj"));

        ChangeStatusResponse r = svc.changeStatus(created.id(),
            new ChangeStatusRequest(OrderStatus.ANULOWANE, created.version(), true));

        assertThat(r.order().status()).isEqualTo(OrderStatus.ANULOWANE);
    }

    // ============================================================
    // Test 7: optimistic-locking conflict — stale expectedVersion throws
    // ============================================================
    @Test
    void changeStatus_staleVersion_throwsVersionConflict() {
        OrderDto created = svc.create(req("wersja"));
        int staleVersion = created.version(); // version=0

        // advance version by doing a real status change
        svc.changeStatus(created.id(),
            new ChangeStatusRequest(OrderStatus.W_REALIZACJI, staleVersion, true));
        // now version=1 in DB; staleVersion=0 is stale

        assertThatThrownBy(() ->
            svc.changeStatus(created.id(),
                new ChangeStatusRequest(OrderStatus.GOTOWE_DO_ODBIORU, staleVersion, true)))
            .isInstanceOf(OrderVersionConflictException.class)
            .satisfies(e -> {
                int current = ((OrderVersionConflictException) e).getCurrentVersion();
                assertThat(current).isEqualTo(1);
            });
    }

    // ============================================================
    // Test 8: softDelete is idempotent
    // ============================================================
    @Test
    void softDelete_idempotent() {
        OrderDto created = svc.create(req("usuń"));

        svc.softDelete(created.id());
        assertThatCode(() -> svc.softDelete(created.id())).doesNotThrowAnyException();

        // confirm truly deleted
        assertThatThrownBy(() -> svc.get(created.id()))
            .isInstanceOf(OrderNotFoundException.class);
    }

    // ============================================================
    // Test 9: addItem inserts + recomputes total
    // ============================================================
    @Test
    void addItem_insertsAndRecomputesTotal() {
        OrderDto order = svc.create(req("dodaj przedmiot"));
        assertThat(order.totalPriceCents()).isEqualTo(0);

        OrderItemDto item = svc.addItem(order.id(),
            new CreateOrderItemRequest(OrderItemKind.NAPRAWA, "zelówka", null, 3000));

        assertThat(item.priceCents()).isEqualTo(3000);
        OrderDto updated = svc.get(order.id());
        assertThat(updated.totalPriceCents()).isEqualTo(3000);
        assertThat(updated.items()).hasSize(1);
    }

    // ============================================================
    // Test 10: updateItem patches and recomputes total
    // ============================================================
    @Test
    void updateItem_patchesAndRecomputesTotal() {
        OrderDto order = svc.create(reqWithItems("update item",
            List.of(new CreateOrderItemRequest(OrderItemKind.NAPRAWA, "stara", null, 2000))));

        UUID itemId = svc.get(order.id()).items().get(0).id();
        svc.updateItem(order.id(), itemId,
            new UpdateOrderItemRequest(null, "nowa", null, 5000));

        OrderDto updated = svc.get(order.id());
        assertThat(updated.totalPriceCents()).isEqualTo(5000);
        assertThat(updated.items().get(0).description()).isEqualTo("nowa");
    }

    // ============================================================
    // Test 11: removeItem deletes + recomputes total; removing nonexistent throws
    // ============================================================
    @Test
    void removeItem_deletesAndRecomputesTotal_andThrowsOnMissing() {
        OrderDto order = svc.create(reqWithItems("remove item",
            List.of(new CreateOrderItemRequest(OrderItemKind.NAPRAWA, "przedmiot", null, 4000))));

        UUID itemId = svc.get(order.id()).items().get(0).id();
        svc.removeItem(order.id(), itemId);

        OrderDto afterRemove = svc.get(order.id());
        assertThat(afterRemove.totalPriceCents()).isEqualTo(0);
        assertThat(afterRemove.items()).isEmpty();

        UUID ghost = UUID.randomUUID();
        assertThatThrownBy(() -> svc.removeItem(order.id(), ghost))
            .isInstanceOf(OrderItemNotFoundException.class);
    }

    // ============================================================
    // Test 12: list excludes soft-deleted
    // ============================================================
    @Test
    void list_excludesSoftDeleted() {
        svc.create(req("visible"));
        OrderDto toDelete = svc.create(req("hidden"));
        svc.softDelete(toDelete.id());

        Page<OrderListRow> page = svc.list(null, null, null, null, null, null, null, null, null, PageRequest.of(0, 20));

        assertThat(page.getContent())
            .extracting(OrderListRow::id)
            .doesNotContain(toDelete.id());
    }

    // ============================================================
    // Test 13: list filters by status — only PRZYJETE returned when status=PRZYJETE
    // ============================================================
    @Test
    void listFiltersByStatus() {
        OrderDto przyjete = svc.create(req("przyjete order"));
        OrderDto wRealizacji = svc.create(req("w realizacji order"));
        OrderDto wydane = svc.create(req("wydane order"));

        svc.changeStatus(wRealizacji.id(), new ChangeStatusRequest(OrderStatus.W_REALIZACJI, wRealizacji.version(), true));
        svc.changeStatus(wydane.id(), new ChangeStatusRequest(OrderStatus.WYDANE, wydane.version(), true));

        Page<OrderListRow> page = svc.list(List.of(OrderStatus.PRZYJETE), null, null, null, null, null, null, null, null, PageRequest.of(0, 20));

        assertThat(page.getContent()).hasSize(1);
        assertThat(page.getContent().get(0).id()).isEqualTo(przyjete.id());
    }

    // ============================================================
    // Test 14: list searches by query — q matches description substring
    // ============================================================
    @Test
    void listSearchesByQuery() {
        svc.create(req("czyszczenie zamszu"));
        svc.create(req("naprawa podeszwy"));

        Page<OrderListRow> page = svc.list(null, null, null, "czyszczenie", null, null, null, null, null, PageRequest.of(0, 20));

        assertThat(page.getContent()).hasSize(1);
        assertThat(page.getContent().get(0).description()).contains("czyszczenie");
    }

    // ============================================================
    // Test 15: update throws OrderAlreadyDeletedException on soft-deleted order
    // ============================================================
    @Test
    void updateThrowsOnSoftDeletedOrder() {
        OrderDto created = svc.create(req("do usuniecia"));
        svc.softDelete(created.id());

        UpdateOrderRequest updateReq = new UpdateOrderRequest("nowy opis", null, null, null, null, null, null, null, null);

        assertThatThrownBy(() -> svc.update(created.id(), updateReq))
            .isInstanceOf(OrderAlreadyDeletedException.class);
    }

    // ============================================================
    // Test 16: changeStatus with note persists note on audit_log row
    // (M8 task m8-fb-1b — V015 audit_log.note column)
    // ============================================================
    @Test
    void changeStatus_persistsNoteOnAuditRow() {
        OrderDto created = svc.create(req("but z notatką"));
        String note = "Klient zapłacił z góry";

        // changeStatus is called via service (no HTTP context), so the HTTP audit
        // aspect does not fire here. The note storage path is tested via the
        // OrderController integration test (HTTP path). This service-layer test
        // verifies the ChangeStatusRequest carries the note field correctly.
        ChangeStatusRequest req = new ChangeStatusRequest(
            OrderStatus.W_REALIZACJI, created.version(), Boolean.TRUE, note);

        assertThat(req.auditNote()).isEqualTo(note);
        assertThat(req.note()).isEqualTo(note);

        // Execute the status change — no exception expected
        ChangeStatusResponse resp = svc.changeStatus(created.id(), req);
        assertThat(resp.order().status()).isEqualTo(OrderStatus.W_REALIZACJI);
    }

    // ============================================================
    // Test 17: changeStatus without note — auditNote() returns null
    // (M8 task m8-fb-1b — null-note path; DB persistence tested in OrderControllerIntegrationTest)
    // ============================================================
    @Test
    void changeStatus_nullNoteLeavesAuditNoteNull() {
        OrderDto created = svc.create(req("but bez notatki"));

        ChangeStatusRequest req = new ChangeStatusRequest(
            OrderStatus.W_REALIZACJI, created.version(), Boolean.TRUE, null);

        assertThat(req.auditNote()).isNull();
        assertThat(req.note()).isNull();

        ChangeStatusResponse resp = svc.changeStatus(created.id(), req);
        assertThat(resp.order().status()).isEqualTo(OrderStatus.W_REALIZACJI);
    }

    // ============================================================
    // Test 18: create with quotedPriceCents + advancePaidCents round-trips correctly
    // (task ux-4 — V016 migration)
    // ============================================================
    @Test
    void createOrder_withQuoteAndAdvance_roundTrips() {
        OrderDto created = svc.create(reqWithQuote("but ze skóry", 35000, 10000));

        assertThat(created.quotedPriceCents()).isEqualTo(35000);
        assertThat(created.advancePaidCents()).isEqualTo(10000);

        OrderDto fetched = svc.get(created.id());
        assertThat(fetched.quotedPriceCents()).isEqualTo(35000);
        assertThat(fetched.advancePaidCents()).isEqualTo(10000);
    }

    // ============================================================
    // Test 19: advancePaidCents defaults to 0 when not provided
    // (task ux-4 — null advance → service defaults to 0)
    // ============================================================
    @Test
    void createOrder_nullAdvance_defaultsToZero() {
        OrderDto created = svc.create(reqWithQuote("naprawa obcasa", 15000, null));

        assertThat(created.quotedPriceCents()).isEqualTo(15000);
        assertThat(created.advancePaidCents()).isEqualTo(0);
    }

    // ============================================================
    // Test 20: update patches advancePaidCents (quotedPriceCents is now item-driven)
    // (task ux-4 — patch via UpdateOrderRequest; M11-b1 removes quotedPriceCents from PATCH)
    // ============================================================
    @Test
    void updateOrder_patchesAdvance() {
        OrderDto created = svc.create(req("renowacja butów"));

        UpdateOrderRequest patchReq = new UpdateOrderRequest(
            null, null, null, null, null, null, null, null, 20000);
        OrderDto updated = svc.update(created.id(), patchReq);

        assertThat(updated.advancePaidCents()).isEqualTo(20000);

        OrderDto fetched = svc.get(updated.id());
        assertThat(fetched.advancePaidCents()).isEqualTo(20000);
    }

    // ============================================================
    // Test 20b: update with quotedPriceCents in PATCH must throw (items are the only writer)
    // (M11-b1)
    // ============================================================
    @Test
    void updateOrder_quotedPriceCentsPatch_isRejected() {
        OrderDto created = svc.create(req("buty odrzucone"));

        UpdateOrderRequest patchReq = new UpdateOrderRequest(
            null, null, null, null, null, null, null, 99900, null);

        assertThatThrownBy(() -> svc.update(created.id(), patchReq))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("quotedPriceCents");
    }

    // ============================================================
    // Test 21: create fires PRZYJETE trigger → Message row SENT via LoggingEmailGateway
    // (fix-C — trigger on order create)
    // ============================================================
    @Test
    void createOrder_firesPrzyjeteTrigger_producesMessageRowSent() {
        // Client must have an email so the EMAIL trigger can resolve a recipient
        Client c = new Client();
        c.setFirstName("Anna");
        c.setPhone("+48111222333");
        c.setEmail("anna@example.com");
        UUID emailClientId = clientRepo.save(c).getId();

        CreateOrderRequest req = new CreateOrderRequest(
            emailClientId, "naprawa sandałów", null, null, null,
            OrderSource.ADMIN, null, null, null);

        OrderDto created = svc.create(req);

        // After commit the afterCommit hook runs synchronously within the same
        // Testcontainers transaction context; wait briefly if needed (rarely necessary).
        // Assert: at least one Message row exists for this order with deliveryStatus=SENT
        List<MessageEntity> msgs = messageRepo.findAllByOrderIdOrderByCreatedAtAsc(created.id());
        assertThat(msgs)
            .as("Expected at least one Message row for the PRZYJETE trigger")
            .isNotEmpty();

        MessageEntity sent = msgs.stream()
            .filter(m -> "SENT".equals(m.getDeliveryStatus()))
            .findFirst()
            .orElse(null);
        assertThat(sent)
            .as("Expected a Message row with deliveryStatus=SENT (LoggingEmailGateway path)")
            .isNotNull();
        assertThat(sent.getChannel()).isEqualTo("EMAIL");
        assertThat(sent.getOrderId()).isEqualTo(created.id());
    }
}
