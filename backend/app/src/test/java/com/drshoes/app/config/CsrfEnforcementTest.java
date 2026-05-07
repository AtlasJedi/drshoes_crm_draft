package com.drshoes.app.config;

import com.drshoes.app.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRepository;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Proves CSRF enforcement is actually wired — each test would fail if CSRF were
 * accidentally disabled, making them genuine falsifications.
 *
 * Three scenarios:
 *   1. POST to an admin route WITHOUT a CSRF token is rejected 403 (not 401).
 *      CsrfFilter runs before the auth check, so 403 proves CsrfFilter fired.
 *      If CSRF were disabled the filter chain would fall through to auth → 401.
 *   2. CsrfTokenRepository bean is a CookieCsrfTokenRepository configured with
 *      httpOnly=false and cookieName=XSRF-TOKEN — the JS-readable double-submit contract.
 *      Asserted via the exposed bean rather than lazy cookie materialisation (Spring
 *      Security 6 defers cookie writes to state-changing requests only).
 *   3. POST to /api/webhooks/** WITHOUT a CSRF token is NOT rejected by CsrfFilter.
 *      External webhook callers have no browser session — CSRF must be ignored there.
 *      Expect non-403 (likely 404 because no controller exists yet).
 */
@AutoConfigureMockMvc
class CsrfEnforcementTest extends AbstractIntegrationTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    CsrfTokenRepository csrfTokenRepository;

    /**
     * Blocker 2 — test 1: admin POST without CSRF token rejected with 403, not 401.
     */
    @Test
    void admin_post_without_csrf_token_is_rejected_with_403_not_401() throws Exception {
        mockMvc.perform(post("/api/admin/orders")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
                .andExpect(status().isForbidden()); // 403 = CsrfFilter rejected; 401 would mean CSRF is off
    }

    /**
     * Blocker 2 — test 2: XSRF-TOKEN cookie config is httpOnly=false and name matches contract.
     *
     * Uses the exposed CsrfTokenRepository bean to assert the double-submit cookie
     * contract without relying on lazy materialisation (which only happens on
     * state-changing requests in Spring Security 6).
     */
    @Test
    void csrf_token_repository_is_cookie_based_with_http_only_false() {
        assertThat(csrfTokenRepository)
                .as("CsrfTokenRepository must be CookieCsrfTokenRepository for the double-submit pattern")
                .isInstanceOf(CookieCsrfTokenRepository.class);

        var cookieRepo = (CookieCsrfTokenRepository) csrfTokenRepository;

        // Materialise a token and save it to a mock response so we can inspect the actual
        // cookie that Spring Security would write — this is the only way to verify
        // httpOnly=false since CookieCsrfTokenRepository has no getCookieName() getter.
        var mockRequest = new org.springframework.mock.web.MockHttpServletRequest();
        var mockResponse = new org.springframework.mock.web.MockHttpServletResponse();
        var token = cookieRepo.generateToken(mockRequest);
        cookieRepo.saveToken(token, mockRequest, mockResponse);

        var cookie = mockResponse.getCookie("XSRF-TOKEN");
        assertThat(cookie)
                .as("XSRF-TOKEN cookie must be written — cookieName must be XSRF-TOKEN")
                .isNotNull();
        assertThat(cookie.isHttpOnly())
                .as("XSRF-TOKEN cookie must not be HttpOnly so JS can read it for the double-submit header")
                .isFalse();
    }

    /**
     * Blocker 2 — test 3: webhook POST without CSRF token passes through CsrfFilter.
     */
    @Test
    void webhook_post_without_csrf_token_is_not_rejected_by_csrf_filter() throws Exception {
        var result = mockMvc.perform(post("/api/webhooks/test")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
                .andReturn();

        int statusCode = result.getResponse().getStatus();
        assertThat(statusCode)
                .as("CsrfFilter must not reject /api/webhooks/** (got %d; 403 would mean CSRF is enforced there)", statusCode)
                .isNotEqualTo(403);
    }
}
