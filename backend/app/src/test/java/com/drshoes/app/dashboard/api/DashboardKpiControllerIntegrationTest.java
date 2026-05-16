package com.drshoes.app.dashboard.api;

import com.drshoes.app.AdminWebTestBase;
import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.order.domain.Order;
import com.drshoes.app.order.domain.OrderRepository;
import com.drshoes.app.order.domain.OrderStatus;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class DashboardKpiControllerIntegrationTest extends AdminWebTestBase {

    @Autowired private OrderRepository orderRepo;
    @Autowired private ClientRepository clientRepo;

    private UUID clientId;

    @BeforeEach
    void seedClient() {
        var c = new Client();
        c.setFirstName("KPI");
        c.setLastName("TestClient");
        c.setPhone("+48 600 000 077");
        clientId = clientRepo.save(c).getId();
    }

    @AfterEach
    void cleanupOrders() {
        orderRepo.deleteAll();
        clientRepo.deleteAll();
    }

    // ----------------------------------------------------------
    // Happy path — seeded counts
    // ----------------------------------------------------------

    @Test
    void happyPathReturnsCorrectCounts() throws Exception {
        loginAsOwner();

        ZoneId warsaw = ZoneId.of("Europe/Warsaw");
        ZonedDateTime todayMidnight = ZonedDateTime.now(warsaw).toLocalDate().atStartOfDay(warsaw);
        Instant todayStart = todayMidnight.toInstant();
        Instant monthStart = todayMidnight.withDayOfMonth(1).toInstant();

        // 2 in-progress
        seedOrder("W-001", OrderStatus.W_REALIZACJI, todayStart, 1000);
        seedOrder("W-002", OrderStatus.W_REALIZACJI, monthStart, 2000);
        // 1 gotowe-do-odbioru
        seedOrder("W-003", OrderStatus.GOTOWE_DO_ODBIORU, monthStart, 5000);
        // 1 received today (for todayIntakeCount)
        seedOrder("W-004", OrderStatus.PRZYJETE, todayStart, 0);

        mockMvc().perform(get("/api/admin/dashboard/kpis"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.inProgressCount").value(2))
            .andExpect(jsonPath("$.readyForPickupCount").value(1))
            .andExpect(jsonPath("$.todayIntakeCount").value(2)) // W-001 + W-004 received today
            .andExpect(jsonPath("$.monthRevenueCents").value(8000))
            .andExpect(jsonPath("$.monthRevenueFormatted").isString());
    }

    // ----------------------------------------------------------
    // Empty database — all zeros
    // ----------------------------------------------------------

    @Test
    void emptyDatabaseReturnsAllZeros() throws Exception {
        loginAsOwner();

        mockMvc().perform(get("/api/admin/dashboard/kpis"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.inProgressCount").value(0))
            .andExpect(jsonPath("$.readyForPickupCount").value(0))
            .andExpect(jsonPath("$.todayIntakeCount").value(0))
            .andExpect(jsonPath("$.monthRevenueCents").value(0))
            .andExpect(jsonPath("$.monthRevenueFormatted").value("0,00 zł"));
    }

    // ----------------------------------------------------------
    // Unauthenticated → 401
    // ----------------------------------------------------------

    @Test
    void unauthenticatedReturns401() throws Exception {
        mockMvc().perform(get("/api/admin/dashboard/kpis"))
            .andExpect(status().isUnauthorized());
    }

    // ----------------------------------------------------------
    // Revenue PLN format — non-zero amount
    // ----------------------------------------------------------

    @Test
    void revenuePlnFormatIsCorrect() throws Exception {
        loginAsOwner();
        ZoneId warsaw = ZoneId.of("Europe/Warsaw");
        Instant monthStart = ZonedDateTime.now(warsaw).toLocalDate().withDayOfMonth(1)
            .atStartOfDay(warsaw).toInstant();

        // 18_240_00 cents = 18240 PLN
        seedOrder("W-010", OrderStatus.GOTOWE_DO_ODBIORU, monthStart, 1824000);

        mockMvc().perform(get("/api/admin/dashboard/kpis"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.monthRevenueCents").value(1824000))
            .andExpect(jsonPath("$.monthRevenueFormatted").value("18 240,00 zł"));
    }

    // ----------------------------------------------------------
    // Soft-deleted orders excluded
    // ----------------------------------------------------------

    @Test
    void softDeletedOrdersExcluded() throws Exception {
        loginAsOwner();
        ZoneId warsaw = ZoneId.of("Europe/Warsaw");
        Instant monthStart = ZonedDateTime.now(warsaw).toLocalDate().withDayOfMonth(1)
            .atStartOfDay(warsaw).toInstant();

        Order deleted = buildOrder("W-020", OrderStatus.W_REALIZACJI, monthStart, 9900);
        deleted.setDeletedAt(Instant.now());
        orderRepo.save(deleted);

        mockMvc().perform(get("/api/admin/dashboard/kpis"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.inProgressCount").value(0))
            .andExpect(jsonPath("$.monthRevenueCents").value(0));
    }

    // ----------------------------------------------------------
    // Money tile: inProgressMoney sums W_REALIZACJI + PRZYJETE
    // ----------------------------------------------------------

    @Test
    void inProgressMoneyAggregatesWRealizacjiAndPrzyjete() throws Exception {
        loginAsOwner();

        ZoneId warsaw = ZoneId.of("Europe/Warsaw");
        Instant now = ZonedDateTime.now(warsaw).toInstant();

        seedOrder("M-001", OrderStatus.W_REALIZACJI, now, 10000);  // 100,00 zł
        seedOrder("M-002", OrderStatus.W_REALIZACJI, now, 20000);  // 200,00 zł
        seedOrder("M-003", OrderStatus.PRZYJETE,     now,  5000);  //  50,00 zł
        seedOrder("M-004", OrderStatus.GOTOWE_DO_ODBIORU, now, 99999); // excluded from inProgress

        mockMvc().perform(get("/api/admin/dashboard/kpis"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.inProgressMoneyCents").value(35000L))
            .andExpect(jsonPath("$.inProgressMoneyFormatted").value("350,00 zł"));
    }

    // ----------------------------------------------------------
    // Money tile: pickedUpMoneyMonth sums WYDANE orders in current month only
    // ----------------------------------------------------------

    @Test
    void pickedUpMoneyMonthExcludesLastMonthOrders() throws Exception {
        loginAsOwner();

        ZoneId warsaw = ZoneId.of("Europe/Warsaw");
        ZonedDateTime nowWaw = ZonedDateTime.now(warsaw);
        Instant thisMonthPickup = nowWaw.toInstant();
        // 45 days ago is reliably last month (or earlier)
        Instant lastMonthPickup = nowWaw.minusDays(45).toInstant();
        Instant receivedAt = nowWaw.toLocalDate().withDayOfMonth(1).atStartOfDay(warsaw).toInstant();

        Order thisMonth = buildOrder("P-001", OrderStatus.WYDANE, receivedAt, 40000);
        thisMonth.setPickedUpAt(thisMonthPickup);
        orderRepo.save(thisMonth);

        Order lastMonth = buildOrder("P-002", OrderStatus.WYDANE, receivedAt, 99999);
        lastMonth.setPickedUpAt(lastMonthPickup);
        orderRepo.save(lastMonth);

        mockMvc().perform(get("/api/admin/dashboard/kpis"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.pickedUpMoneyMonthCents").value(40000L))
            .andExpect(jsonPath("$.pickedUpMoneyMonthFormatted").value("400,00 zł"));
    }

    // ----------------------------------------------------------
    // Helpers
    // ----------------------------------------------------------

    private void seedOrder(String code, OrderStatus status, Instant receivedAt, int priceCents) {
        orderRepo.save(buildOrder(code, status, receivedAt, priceCents));
    }

    private Order buildOrder(String code, OrderStatus status, Instant receivedAt, int priceCents) {
        var o = new Order();
        o.setCode(code);
        o.setClientId(clientId);
        o.setStatus(status);
        o.setReceivedAt(receivedAt);
        o.setTotalPriceCents(priceCents);
        return o;
    }
}
