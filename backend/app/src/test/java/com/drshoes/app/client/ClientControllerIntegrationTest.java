package com.drshoes.app.client;

import com.drshoes.app.AdminWebTestBase;
import org.junit.jupiter.api.Test;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Integration tests for ClientController.
 *
 * RBAC coverage:
 *   - unauthenticated GET → 401
 *   - EMPLOYEE DELETE → 403
 *   - OWNER DELETE → 204
 *
 * CSRF coverage:
 *   - all POST/PATCH/DELETE calls include .with(csrf())
 *   - the CsrfEnforcementTest already proves a POST without csrf() → 403
 */
class ClientControllerIntegrationTest extends AdminWebTestBase {

    @Test
    void createListAndGetAsOwner() throws Exception {
        loginAsOwner();
        String body = """
            {"firstName":"Anna","lastName":"Kowalska","phone":"+48 600 100 200","email":"a@k.pl"}""";

        // POST → 201 + Location
        mockMvc().perform(post("/api/admin/clients")
                .contentType("application/json")
                .content(body)
                .with(csrf()))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.firstName").value("Anna"));

        // LIST → 200 + first entry
        mockMvc().perform(get("/api/admin/clients?page=0&size=10"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content[0].lastName").value("Kowalska"));

        // SEARCH → 200 + fullName
        mockMvc().perform(get("/api/admin/clients/search?q=kowal"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].fullName").value("Anna Kowalska"));
    }

    @Test
    void getAfterCreate() throws Exception {
        loginAsOwner();
        String body = """
            {"firstName":"Bartek","phone":"+48 700 200 300"}""";

        String location = mockMvc().perform(post("/api/admin/clients")
                .contentType("application/json")
                .content(body)
                .with(csrf()))
            .andExpect(status().isCreated())
            .andReturn().getResponse().getHeader("Location");

        // GET by id extracted from Location header
        mockMvc().perform(get(location))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.firstName").value("Bartek"));
    }

    @Test
    void patchUpdatesClient() throws Exception {
        loginAsOwner();
        var id = createClientAndReturnId();

        mockMvc().perform(patch("/api/admin/clients/" + id)
                .contentType("application/json")
                .content("""
                    {"firstName":"Updated"}""")
                .with(csrf()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.firstName").value("Updated"));
    }

    @Test
    void deleteRequiresOwner() throws Exception {
        // EMPLOYEE → 403
        loginAsEmployee();
        var id = createClientAndReturnId();
        mockMvc().perform(delete("/api/admin/clients/" + id).with(csrf()))
            .andExpect(status().isForbidden());

        // OWNER → 204
        loginAsOwner();
        mockMvc().perform(delete("/api/admin/clients/" + id).with(csrf()))
            .andExpect(status().isNoContent());
    }

    @Test
    void unauthenticatedRejected() throws Exception {
        // No loginAs* call — session is null → anonymous request
        mockMvc().perform(get("/api/admin/clients"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void getNonExistentClientReturns404() throws Exception {
        loginAsOwner();
        mockMvc().perform(get("/api/admin/clients/00000000-0000-0000-0000-000000000000"))
            .andExpect(status().isNotFound());
    }
}
