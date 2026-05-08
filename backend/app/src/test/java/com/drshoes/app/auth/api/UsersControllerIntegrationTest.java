package com.drshoes.app.auth.api;

import com.drshoes.app.AdminWebTestBase;
import org.junit.jupiter.api.Test;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Integration tests for UsersController GET /api/admin/users.
 *
 * Audit-coverage note: GET /api/admin/users is a read-only endpoint;
 * AuditLogAspect only fires on write operations. Audit test omitted by design.
 *
 * RBAC coverage:
 *   - unauthenticated GET → 401
 *   - EMPLOYEE GET → 200 (any authenticated admin may read the assignee dropdown)
 *   - OWNER GET → 200 + body contains both seeded users with correct fullName and role
 */
class UsersControllerIntegrationTest extends AdminWebTestBase {

    @Test
    void ownerGetsAllActiveUsers() throws Exception {
        loginAsOwner();

        mockMvc().perform(get("/api/admin/users"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(2))
            .andExpect(jsonPath("$[?(@.fullName == 'Owner Test')].role").value("OWNER"))
            .andExpect(jsonPath("$[?(@.fullName == 'Employee Test')].role").value("EMPLOYEE"));
    }

    @Test
    void anonymousGets401() throws Exception {
        // No loginAs* — anonymous request
        mockMvc().perform(get("/api/admin/users"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void employeeCanAlsoReadUsers() throws Exception {
        loginAsEmployee();

        mockMvc().perform(get("/api/admin/users"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(2));
    }
}
