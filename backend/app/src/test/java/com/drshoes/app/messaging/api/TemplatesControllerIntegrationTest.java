package com.drshoes.app.messaging.api;

import com.drshoes.app.AdminWebTestBase;
import com.drshoes.app.audit.AuditLogRepository;
import com.drshoes.app.messaging.repository.MessageTemplateRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MvcResult;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Integration tests for TemplatesController.
 *
 * Uses AdminWebTestBase session-aware mockMvc() pattern:
 *   loginAsOwner() / loginAsEmployee() set the principal; csrf() is added
 *   manually on state-changing requests.
 *
 * Audit coverage: postCreateReturns201AndWritesAuditRow asserts AuditLogAspect
 * fires on POST /api/admin/templates because the controller lives in .api. package.
 *
 * Isolation: @BeforeEach removes templates added by previous tests in this class,
 * restoring the DB to the 4 V006-seeded rows only.
 */
class TemplatesControllerIntegrationTest extends AdminWebTestBase {

    private static final Set<String> SEED_NAMES = Set.of(
        "Zlecenie przyjete (EMAIL)",
        "Gotowe do odbioru (EMAIL)",
        "Przypomnienie o odbiorze (SMS)",
        "Prosba o opinie (EMAIL)",
        "Dr Shoes - followup (EMAIL)"   // V026 — must not be cleaned up between tests
    );

    @Autowired
    private AuditLogRepository audits;

    @Autowired
    private MessageTemplateRepository templateRepo;

    @BeforeEach
    void cleanNonSeedTemplates() {
        templateRepo.findAll().stream()
            .filter(t -> !SEED_NAMES.contains(t.getName()))
            .forEach(t -> templateRepo.delete(t));
        // Restore seeded templates to active=true in case a prior test soft-deleted one
        templateRepo.findAll().forEach(t -> {
            t.setActive(true);
            templateRepo.save(t);
        });
    }

    @Test
    void getListReturnsSeededTemplates() throws Exception {
        loginAsOwner();
        mockMvc().perform(get("/api/admin/templates"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(5));
    }

    @Test
    void postCreateReturns201AndWritesAuditRow() throws Exception {
        loginAsOwner();
        long beforeAudit = audits.count();

        MvcResult res = mockMvc().perform(post("/api/admin/templates")
                .with(csrf())
                .contentType("application/json")
                .content("{\"name\":\"Custom\",\"channel\":\"EMAIL\",\"subject\":\"S\",\"body\":\"B\",\"active\":true}"))
            .andExpect(status().isCreated())
            .andReturn();

        assertThat(res.getResponse().getContentAsString()).contains("\"name\":\"Custom\"");
        assertThat(audits.count()).isGreaterThan(beforeAudit);
    }

    @Test
    void postRejectsDuplicateName() throws Exception {
        loginAsOwner();
        mockMvc().perform(post("/api/admin/templates")
                .with(csrf())
                .contentType("application/json")
                .content("{\"name\":\"Zlecenie przyjete (EMAIL)\",\"channel\":\"EMAIL\",\"body\":\"X\",\"active\":true}"))
            .andExpect(status().isConflict());
    }

    @Test
    void patchUpdatesSubject() throws Exception {
        loginAsOwner();
        String createBody = mockMvc().perform(post("/api/admin/templates")
                .with(csrf())
                .contentType("application/json")
                .content("{\"name\":\"Patch test\",\"channel\":\"EMAIL\",\"subject\":\"old\",\"body\":\"B\",\"active\":true}"))
            .andReturn().getResponse().getContentAsString();
        String id = createBody.split("\"id\":\"")[1].split("\"")[0];

        mockMvc().perform(patch("/api/admin/templates/" + id)
                .with(csrf())
                .contentType("application/json")
                .content("{\"subject\":\"new\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.subject").value("new"));
    }

    @Test
    void deleteSetsActiveFalse() throws Exception {
        loginAsOwner();
        String createBody = mockMvc().perform(post("/api/admin/templates")
                .with(csrf())
                .contentType("application/json")
                .content("{\"name\":\"Delete me\",\"channel\":\"EMAIL\",\"body\":\"B\",\"active\":true}"))
            .andReturn().getResponse().getContentAsString();
        String id = createBody.split("\"id\":\"")[1].split("\"")[0];

        mockMvc().perform(delete("/api/admin/templates/" + id).with(csrf()))
            .andExpect(status().isNoContent());

        mockMvc().perform(get("/api/admin/templates/" + id))
            .andExpect(jsonPath("$.active").value(false));
    }

    @Test
    void unauthenticatedReturns401() throws Exception {
        // No loginAs* call — anonymous request
        mockMvc().perform(get("/api/admin/templates"))
            .andExpect(status().isUnauthorized());
    }
}
