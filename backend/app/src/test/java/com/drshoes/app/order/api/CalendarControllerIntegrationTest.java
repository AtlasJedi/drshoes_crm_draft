package com.drshoes.app.order.api;

import com.drshoes.app.AdminWebTestBase;
import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.order.domain.*;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class CalendarControllerIntegrationTest extends AdminWebTestBase {

    @Autowired private OrderRepository orderRepo;
    @Autowired private OrderItemRepository itemRepo;
    @Autowired private ClientRepository clientRepo;

    private UUID clientId;
    private String today;
    private String nextWeek;

    @BeforeEach
    void seedClient() {
        var c = new Client();
        c.setFirstName("Kal");
        c.setLastName("TestClient");
        c.setPhone("+48 600 000 055");
        clientId = clientRepo.save(c).getId();

        ZoneId warsaw = ZoneId.of("Europe/Warsaw");
        today    = ZonedDateTime.now(warsaw).toLocalDate().toString();
        nextWeek = ZonedDateTime.now(warsaw).toLocalDate().plusDays(7).toString();
    }

    @AfterEach
    void cleanup() {
        itemRepo.deleteAll();
        orderRepo.deleteAll();
        clientRepo.deleteAll();
    }

    // ----------------------------------------------------------
    // Happy path — scheduled order appears in window
    // ----------------------------------------------------------

    @Test
    void scheduledOrderAppearsInWindow() throws Exception {
        loginAsOwner();
        ZoneId warsaw = ZoneId.of("Europe/Warsaw");
        Instant tomorrow = ZonedDateTime.now(warsaw).toLocalDate().plusDays(1)
            .atStartOfDay(warsaw).toInstant();
        seedOrder("K-001", OrderStatus.PRZYJETE, tomorrow, null);

        mockMvc().perform(get("/api/admin/orders/calendar?from=" + today + "&to=" + nextWeek))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.scheduled").isArray())
            .andExpect(jsonPath("$.scheduled", hasSize(greaterThanOrEqualTo(1))))
            .andExpect(jsonPath("$.scheduled[0].code").value("K-001"))
            .andExpect(jsonPath("$.scheduled[0].plannedPickupAt").isString())
            .andExpect(jsonPath("$.scheduled[0].clientName").value("Kal TestClient"));
    }

    // ----------------------------------------------------------
    // Range > 92 days → 400
    // ----------------------------------------------------------

    @Test
    void rangeOver92DaysReturns400() throws Exception {
        loginAsOwner();
        ZoneId warsaw = ZoneId.of("Europe/Warsaw");
        String farFuture = ZonedDateTime.now(warsaw).toLocalDate().plusDays(100).toString();

        mockMvc().perform(get("/api/admin/orders/calendar?from=" + today + "&to=" + farFuture))
            .andExpect(status().isBadRequest());
    }

    // ----------------------------------------------------------
    // from > to → 400
    // ----------------------------------------------------------

    @Test
    void fromAfterToReturns400() throws Exception {
        loginAsOwner();
        mockMvc().perform(get("/api/admin/orders/calendar?from=" + nextWeek + "&to=" + today))
            .andExpect(status().isBadRequest());
    }

    // ----------------------------------------------------------
    // v2-B: orders without plannedPickupAt appear in scheduled[] (not unscheduled[])
    // ----------------------------------------------------------

    @Test
    void orderWithoutPlannedPickupAppearsInScheduledWithDefaultedFlag() throws Exception {
        loginAsOwner();
        // receivedAt = today − 7 days → effectivePickupAt = today + 7 days (within nextWeek window)
        Instant receivedAt = Instant.now().minus(7, ChronoUnit.DAYS);
        seedOrder("K-002", OrderStatus.W_REALIZACJI, null, receivedAt);

        mockMvc().perform(get("/api/admin/orders/calendar?from=" + today + "&to=" + nextWeek))
            .andExpect(status().isOk())
            // v2-B: unscheduled array is always empty
            .andExpect(jsonPath("$.unscheduled").isEmpty())
            // The order appears in scheduled[] with pickupAtDefaulted=true
            .andExpect(jsonPath("$.scheduled[?(@.code=='K-002')]").exists())
            .andExpect(jsonPath("$.scheduled[?(@.code=='K-002')].pickupAtDefaulted")
                .value(hasItem(true)));
    }

    // ----------------------------------------------------------
    // WYDANE / ANULOWANE orders excluded from both arrays
    // ----------------------------------------------------------

    @Test
    void wydaneAndAnulowaneExcluded() throws Exception {
        loginAsOwner();
        ZoneId warsaw = ZoneId.of("Europe/Warsaw");
        Instant tomorrow = ZonedDateTime.now(warsaw).toLocalDate().plusDays(1)
            .atStartOfDay(warsaw).toInstant();
        seedOrder("K-003", OrderStatus.WYDANE, tomorrow, null);
        seedOrder("K-004", OrderStatus.ANULOWANE, null, null);

        mockMvc().perform(get("/api/admin/orders/calendar?from=" + today + "&to=" + nextWeek))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.scheduled[?(@.code=='K-003')]").doesNotExist())
            .andExpect(jsonPath("$.unscheduled[?(@.code=='K-004')]").doesNotExist());
    }

    // ----------------------------------------------------------
    // Soft-deleted excluded
    // ----------------------------------------------------------

    @Test
    void softDeletedExcluded() throws Exception {
        loginAsOwner();
        ZoneId warsaw = ZoneId.of("Europe/Warsaw");
        Instant tomorrow = ZonedDateTime.now(warsaw).toLocalDate().plusDays(1)
            .atStartOfDay(warsaw).toInstant();
        UUID id = seedOrder("K-005", OrderStatus.PRZYJETE, tomorrow, null);
        Order o = orderRepo.findById(id).orElseThrow();
        o.setDeletedAt(Instant.now());
        orderRepo.save(o);

        mockMvc().perform(get("/api/admin/orders/calendar?from=" + today + "&to=" + nextWeek))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.scheduled[?(@.code=='K-005')]").doesNotExist());
    }

    // ----------------------------------------------------------
    // ux-2: scheduled entry must have receivedAt populated (not null)
    // ----------------------------------------------------------

    @Test
    void scheduledEntryHasReceivedAtPopulated() throws Exception {
        loginAsOwner();
        ZoneId warsaw = ZoneId.of("Europe/Warsaw");
        Instant tomorrow = ZonedDateTime.now(warsaw).toLocalDate().plusDays(1)
            .atStartOfDay(warsaw).toInstant();
        // seedOrder sets receivedAt = Instant.now() when param is null
        seedOrder("K-REC", OrderStatus.PRZYJETE, tomorrow, null);

        // Use a dedicated window containing only this one order so [0] is reliable
        mockMvc().perform(get("/api/admin/orders/calendar?from=" + today + "&to=" + nextWeek))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.scheduled[?(@.code=='K-REC')]").exists())
            // receivedAt must be a non-null string (ISO instant) on scheduled entries
            .andExpect(jsonPath("$.scheduled[?(@.code=='K-REC')].receivedAt").isArray())
            .andExpect(jsonPath("$.scheduled[?(@.code=='K-REC')].receivedAt",
                hasItem(notNullValue())));
    }

    // ----------------------------------------------------------
    // Unauthenticated → 401
    // ----------------------------------------------------------

    @Test
    void unauthenticatedReturns401() throws Exception {
        mockMvc().perform(get("/api/admin/orders/calendar?from=" + today + "&to=" + nextWeek))
            .andExpect(status().isUnauthorized());
    }

    // ----------------------------------------------------------
    // v2-B: effectivePickupAt with explicit plannedPickupAt
    // ----------------------------------------------------------

    @Test
    void calendarReturnsEffectivePickupAt_withPlannedPickup() throws Exception {
        loginAsOwner();
        ZoneId warsaw = ZoneId.of("Europe/Warsaw");
        Instant tomorrow = ZonedDateTime.now(warsaw).toLocalDate().plusDays(1)
            .atStartOfDay(warsaw).toInstant();
        seedOrder("K-EFF-1", OrderStatus.PRZYJETE, tomorrow, null);

        mockMvc().perform(get("/api/admin/orders/calendar?from=" + today + "&to=" + nextWeek))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.scheduled[?(@.code=='K-EFF-1')].effectivePickupAt").isArray())
            .andExpect(jsonPath("$.scheduled[?(@.code=='K-EFF-1')].pickupAtDefaulted")
                .value(hasItem(false)));
    }

    // ----------------------------------------------------------
    // v2-B: effectivePickupAt fallback = receivedAt + 14d when no plannedPickupAt
    // ----------------------------------------------------------

    @Test
    void calendarReturnsEffectivePickupAt_withFallbackPlus14d() throws Exception {
        loginAsOwner();
        // receivedAt = today − 7 days → effectivePickupAt = today + 7 days (within nextWeek window)
        // This ensures the +14d fallback lands inside [today, nextWeek].
        Instant receivedAt = Instant.now().minus(7, ChronoUnit.DAYS);
        seedOrder("K-EFF-2", OrderStatus.W_REALIZACJI, null, receivedAt);

        mockMvc().perform(get("/api/admin/orders/calendar?from=" + today + "&to=" + nextWeek))
            .andExpect(status().isOk())
            // Order without plannedPickupAt now appears in scheduled[] with defaulted flag
            .andExpect(jsonPath("$.scheduled[?(@.code=='K-EFF-2')].pickupAtDefaulted")
                .value(hasItem(true)))
            .andExpect(jsonPath("$.scheduled[?(@.code=='K-EFF-2')].effectivePickupAt").isArray());
    }

    // ----------------------------------------------------------
    // Helpers
    // ----------------------------------------------------------

    private UUID seedOrder(String code, OrderStatus status, Instant plannedPickupAt,
                           Instant receivedAt) {
        var o = new Order();
        o.setCode(code);
        o.setClientId(clientId);
        o.setStatus(status);
        o.setPlannedPickupAt(plannedPickupAt);
        o.setReceivedAt(receivedAt != null ? receivedAt : Instant.now());
        return orderRepo.save(o).getId();
    }
}
