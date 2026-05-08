package com.drshoes.app.messaging.api;

import com.drshoes.app.AdminWebTestBase;
import com.drshoes.app.messaging.repository.TriggerRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Integration tests for TriggersController.
 *
 * Uses AdminWebTestBase session-aware mockMvc() pattern:
 *   loginAsOwner() / loginAsEmployee() set the principal; csrf() added on mutations.
 *
 * Isolation: @AfterEach resets all triggers to enabled=true so toggle test
 * doesn't affect other tests via shared Spring context.
 */
class TriggersControllerIntegrationTest extends AdminWebTestBase {

    @Autowired
    private TriggerRepository triggerRepo;

    @AfterEach
    void resetTriggerState() {
        triggerRepo.findAll().forEach(t -> {
            t.setEnabled(true);
            triggerRepo.save(t);
        });
    }

    @Test
    void listReturnsFourSeededTriggers() throws Exception {
        loginAsOwner();
        mockMvc().perform(get("/api/admin/triggers"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(4));
    }

    @Test
    void detailIncludesTemplateName() throws Exception {
        loginAsOwner();
        String list = mockMvc().perform(get("/api/admin/triggers"))
            .andReturn().getResponse().getContentAsString();
        String id = list.split("\"id\":\"")[1].split("\"")[0];

        mockMvc().perform(get("/api/admin/triggers/" + id))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.templateName").exists());
    }

    @Test
    void toggleEnabledFlipsField() throws Exception {
        loginAsOwner();
        String list = mockMvc().perform(get("/api/admin/triggers"))
            .andReturn().getResponse().getContentAsString();
        String id = list.split("\"id\":\"")[1].split("\"")[0];

        mockMvc().perform(patch("/api/admin/triggers/" + id + "/enabled")
                .with(csrf())
                .contentType("application/json")
                .content("{\"enabled\":false}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.enabled").value(false));
        // @AfterEach resets enabled=true for all triggers
    }

    @Test
    void employeeCanReadCannotToggle() throws Exception {
        loginAsEmployee();
        String list = mockMvc().perform(get("/api/admin/triggers"))
            .andReturn().getResponse().getContentAsString();
        String id = list.split("\"id\":\"")[1].split("\"")[0];

        mockMvc().perform(patch("/api/admin/triggers/" + id + "/enabled")
                .with(csrf())
                .contentType("application/json")
                .content("{\"enabled\":false}"))
            .andExpect(status().isForbidden());
    }
}
