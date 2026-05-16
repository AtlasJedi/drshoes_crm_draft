package com.drshoes.app.order.api;

import com.drshoes.app.AdminWebTestBase;
import com.drshoes.app.audit.AuditLog;
import com.drshoes.app.audit.AuditLogRepository;
import com.drshoes.app.order.domain.Order;
import com.drshoes.app.order.domain.OrderRepository;
import com.drshoes.app.order.domain.OrderStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Verifies that PATCH /api/admin/orders/{id} writes a Polish field-diff note
 * into audit_log.note when the request changes one or more order fields.
 */
class OrderUpdateAuditDiffIntegrationTest extends AdminWebTestBase {

    @Autowired private OrderRepository orders;
    @Autowired private AuditLogRepository audits;

    private UUID clientId;

    @BeforeEach
    void setup() {
        clientId = createClientAndReturnId();
        loginAsOwner();
    }

    @Test
    void PATCH_advancePaidCentsChange_auditNoteMatchesZaliczkaFormat() throws Exception {
        // quotedPriceCents is now item-driven (M11-b1); use advancePaidCents to test diff format
        Order o = persistOrder(0, 0);

        mockMvc().perform(patch("/api/admin/orders/" + o.getId())
                .contentType("application/json")
                .content("{\"advancePaidCents\":10000}")
                .with(csrf()))
            .andExpect(status().isOk());

        List<AuditLog> rows = audits.findOrderTimelineRows(
            "/api/admin/orders/" + o.getId() + "%", o.getId());
        assertThat(rows).isNotEmpty();
        AuditLog latest = rows.get(rows.size() - 1);
        assertThat(latest.getNote()).isEqualTo("Zaliczka zmieniona z 0,00 zł na 100,00 zł");
    }

    @Test
    void PATCH_twoFieldsChanged_noteSeparatedByBullet() throws Exception {
        // Use description + advancePaidCents to exercise multi-field diff separator
        Order o = persistOrder(0, 0);

        mockMvc().perform(patch("/api/admin/orders/" + o.getId())
                .contentType("application/json")
                .content("{\"description\":\"nowy opis\",\"advancePaidCents\":1000}")
                .with(csrf()))
            .andExpect(status().isOk());

        List<AuditLog> rows = audits.findOrderTimelineRows(
            "/api/admin/orders/" + o.getId() + "%", o.getId());
        assertThat(rows).isNotEmpty();
        String note = rows.get(rows.size() - 1).getNote();
        assertThat(note).isNotNull();
        assertThat(note).contains(" · ");
        assertThat(note).contains("Zaliczka zmieniona");
    }

    @Test
    void PATCH_noActualChanges_auditNoteIsNull() throws Exception {
        Order o = persistOrder(0, 500);

        // Send the exact same advancePaidCents value — diff should be null → note null in audit
        mockMvc().perform(patch("/api/admin/orders/" + o.getId())
                .contentType("application/json")
                .content("{\"advancePaidCents\":500}")
                .with(csrf()))
            .andExpect(status().isOk());

        List<AuditLog> rows = audits.findOrderTimelineRows(
            "/api/admin/orders/" + o.getId() + "%", o.getId());
        assertThat(rows).isNotEmpty();
        AuditLog latest = rows.get(rows.size() - 1);
        assertThat(latest.getNote()).isNull();
    }

    // ---- helpers ----

    private Order persistOrder(int quotedPriceCents, int advancePaidCents) {
        Order o = new Order();
        o.setCode("DIFF-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        o.setClientId(clientId);
        o.setStatus(OrderStatus.PRZYJETE);
        o.setQuotedPriceCents(quotedPriceCents);
        o.setAdvancePaidCents(advancePaidCents);
        return orders.save(o);
    }
}
