package com.drshoes.app.audit;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.drshoes.app.AdminWebTestBase;
import com.drshoes.app.auth.api.dto.LoginRequest;
import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.order.OrderService;
import com.drshoes.app.order.domain.OrderItemRepository;
import com.drshoes.app.order.domain.OrderRepository;
import com.drshoes.app.order.domain.OrderSource;
import com.drshoes.app.order.dto.CreateOrderItemRequest;
import com.drshoes.app.order.dto.CreateOrderRequest;
import com.drshoes.app.order.domain.OrderItemKind;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.context.annotation.Bean;
import org.springframework.http.*;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Integration tests for AuditLogAspect — HTTP controller pointcut and @Audited service pointcut.
 *
 * Extends AdminWebTestBase to gain MockMvc + principal injection for Fix 1.
 * TestRestTemplate is also available (RANDOM_PORT context) for existing login tests.
 */
class AuditLogAspectIntegrationTest extends AdminWebTestBase {

    // ---- inner @TestConfiguration for Fix 2 ----

    /**
     * Throwaway Spring bean with a method bearing a deliberately broken @Audited expression.
     * Registered via @TestConfiguration — visible to AOP proxies, never touches production code.
     *
     * Expression "#nonExistentVariable.toString()" is used rather than plain "#nonExistentVariable"
     * because the latter returns null (undefined variable → null in SimpleEvaluationContext, no
     * exception). Adding a method call on the null result forces SpelEvaluationException to be
     * thrown, which triggers the catch block and WARN log in AuditedParentResolver.
     */
    @Service
    static class BrokenSpelAuditedService {
        /**
         * Returns a fixed sentinel. The @Audited expression chains a method call on a
         * non-existent variable — SpEL throws SpelEvaluationException (null target),
         * which AuditedParentResolver catches, logs at WARN, and returns null.
         */
        @Audited(parent = "#nonExistentVariable.toString()")
        public String doWork() {
            return "sentinel";
        }
    }

    @TestConfiguration
    static class TestConfig {
        @Bean
        BrokenSpelAuditedService brokenSpelAuditedService() {
            return new BrokenSpelAuditedService();
        }
    }

    // ---- fields ----

    @Autowired TestRestTemplate rest;
    @Autowired AuditLogRepository auditLog;
    @Autowired ClientRepository clientRepo;
    @Autowired OrderRepository orderRepo;
    @Autowired OrderItemRepository orderItemRepo;
    @Autowired OrderService orderService;
    @Autowired BrokenSpelAuditedService brokenSpelAuditedService;

    private UUID clientId;

    // ---- lifecycle ----

    /**
     * Runs AFTER AdminWebTestBase.seedUsers() (JUnit 5 @BeforeEach ordering: superclass first).
     * Clears audit/order data and seeds a client for order-based tests.
     * Does NOT create a new user — relies on the OWNER seeded by AdminWebTestBase.
     */
    @BeforeEach
    void seedAuditData() {
        orderItemRepo.deleteAll();
        orderRepo.deleteAll();
        auditLog.deleteAll();
        // clientRepo is cleaned by AdminWebTestBase.seedUsers(); create fresh one here
        var c = new Client();
        c.setFirstName("Test");
        c.setPhone("+48123000000");
        clientId = clientRepo.save(c).getId();
    }

    /**
     * Runs BEFORE AdminWebTestBase.cleanupUsers() (JUnit 5 @AfterEach: subclass first).
     * Clears audit/order tables before parent cleans users+clients.
     */
    @AfterEach
    void cleanupAuditData() {
        orderItemRepo.deleteAll();
        orderRepo.deleteAll();
        auditLog.deleteAll();
    }

    // ---- existing tests (regression guard) ----

    @Test
    void login_writes_audit_log_row() {
        var headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        rest.exchange("/api/admin/auth/login", HttpMethod.POST,
            new HttpEntity<>(new LoginRequest("owner@test.pl", "pass"), headers), String.class);
        assertThat(auditLog.count()).isEqualTo(1);
    }

    @Test
    void failed_login_writes_exactly_one_audit_row() {
        var headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        var resp = rest.exchange("/api/admin/auth/login", HttpMethod.POST,
            new HttpEntity<>(new LoginRequest("owner@test.pl", "wrong"), headers), String.class);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(auditLog.count()).isEqualTo(1);
    }

    // ---- new tests for @Audited parent_entity_id ----

    /**
     * Test 1: @Audited(parent="#orderId") on OrderService.addItem populates parent_entity_id.
     * Also covers spelEvaluatesAgainstArgs (the #orderId binding resolves to the first arg).
     */
    @Test
    void auditedAnnotationPopulatesParentEntityId() {
        var order = orderService.create(new CreateOrderRequest(
            clientId, "test order", null, null, null, OrderSource.ADMIN, null, null, null));
        UUID orderId = order.id();

        auditLog.deleteAll(); // clear create-order row(s)

        orderService.addItem(orderId,
            new CreateOrderItemRequest(OrderItemKind.NAPRAWA, "zelówka", null, 3000));

        List<AuditLog> rows = auditLog.findAll();
        // One row from the @Audited advice on OrderService.addItem
        assertThat(rows).isNotEmpty();
        AuditLog latest = rows.stream()
            .max(Comparator.comparing(AuditLog::getCreatedAt))
            .orElseThrow();
        assertThat(latest.getParentEntityId())
            .as("parent_entity_id should equal orderId")
            .isEqualTo(orderId);
    }

    /**
     * Test 2 (Fix 1 — non-vacuous): A controller endpoint without @Audited writes an HTTP
     * audit row, and that row has parent_entity_id = null.
     *
     * Previously the test called clientService.create() directly — no HTTP context, so zero
     * rows were written and the forEach assertion over an empty list was vacuously true.
     * Now we route through MockMvc (real HTTP request context), assert status 201, then
     * assert the exactly-one audit row has parent_entity_id = null.
     *
     * Regression sensitivity: if AuditLogAspect were changed to populate parent_entity_id
     * on HTTP rows, this test would fail — correctly catching the regression.
     */
    @Test
    void methodWithoutAuditedAnnotationLeavesParentEntityIdNull() throws Exception {
        loginAsOwner();
        auditLog.deleteAll();

        // POST /api/admin/clients triggers the controller-level audit pointcut.
        // ClientController (and ClientService.create) has no @Audited annotation.
        mockMvc().perform(post("/api/admin/clients")
                .contentType("application/json")
                .content("""
                    {"firstName":"Anna","lastName":"Nowak","phone":"+48600111222"}""")
                .with(csrf()))
            .andExpect(status().isCreated());

        // The controller audit advice fires → exactly one row written.
        List<AuditLog> rows = auditLog.findAll();
        assertThat(rows)
            .as("controller audit must write exactly one row for POST /api/admin/clients")
            .hasSize(1);
        assertThat(rows.get(0).getParentEntityId())
            .as("parent_entity_id must be null — ClientController is not @Audited")
            .isNull();
    }

    /**
     * Test 3 (Fix 2 — full-stack SpEL failure): Verifies that when a service method is
     * annotated @Audited(parent="#nonExistentVariable") and called through the Spring AOP
     * proxy, the aspect handles SpEL failure gracefully:
     *   (a) the wrapped method returns its expected value (no exception to caller),
     *   (b) an audit_log row is written (count delta == 1),
     *   (c) parent_entity_id IS NULL on that row,
     *   (d) a WARN log line with op=auditParentEvalFailed and expr=#nonExistentVariable is emitted.
     *
     * Uses BrokenSpelAuditedService (registered via @TestConfiguration) to avoid touching
     * production code. The bean is auto-proxied by Spring AOP — the aspect fires because
     * the call crosses a bean boundary (test → Spring proxy → BrokenSpelAuditedService).
     */
    @Test
    void spelFailureDoesNotBreakAuditRow() {
        // Attach a ListAppender to AuditedParentResolver's logger to capture WARN output.
        Logger resolverLogger = (Logger) LoggerFactory.getLogger(AuditedParentResolver.class);
        ListAppender<ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        resolverLogger.addAppender(appender);

        try {
            auditLog.deleteAll();
            long before = auditLog.count(); // == 0

            // Invoke through the Spring proxy — AOP advice fires.
            String result = brokenSpelAuditedService.doWork();

            // (a) no exception bubbled; method returned sentinel
            assertThat(result)
                .as("wrapped method must return normally despite broken SpEL")
                .isEqualTo("sentinel");

            // (b) exactly one audit row written
            long delta = auditLog.count() - before;
            assertThat(delta)
                .as("audit row must be written even when SpEL fails")
                .isEqualTo(1);

            // (c) parent_entity_id IS NULL
            List<AuditLog> rows = auditLog.findAll();
            assertThat(rows.get(0).getParentEntityId())
                .as("parent_entity_id must be null when SpEL expression fails to resolve")
                .isNull();

            // (d) WARN log with op=auditParentEvalFailed and the broken expression
            List<ILoggingEvent> warns = appender.list.stream()
                .filter(e -> e.getLevel() == Level.WARN)
                .toList();
            assertThat(warns)
                .as("AuditedParentResolver must emit at least one WARN for failed SpEL")
                .isNotEmpty();
            String warnMessage = warns.get(0).getFormattedMessage();
            assertThat(warnMessage)
                .as("WARN must reference op=auditParentEvalFailed")
                .contains("op=auditParentEvalFailed");
            assertThat(warnMessage)
                .as("WARN must include the failing expression")
                .contains("#nonExistentVariable.toString()");
        } finally {
            resolverLogger.detachAppender(appender);
            appender.stop();
        }
    }

    /**
     * Test 4: #orderId SpEL expression resolves to the correct first argument.
     * This is the parameter-name binding correctness check.
     * (Partially covered by test 1, but spelt out explicitly per plan §6.)
     */
    @Test
    void spelEvaluatesAgainstArgs() throws Exception {
        var resolver = new AuditedParentResolver();
        var method = OrderService.class.getMethod("addItem", UUID.class, CreateOrderItemRequest.class);
        UUID expectedOrderId = UUID.randomUUID();
        var req = new CreateOrderItemRequest(OrderItemKind.NAPRAWA, "desc", null, 2000);

        UUID resolved = resolver.resolve(method, new Object[]{expectedOrderId, req}, "#orderId");

        assertThat(resolved)
            .as("#orderId SpEL must resolve to the first argument")
            .isEqualTo(expectedOrderId);
    }
}
