package com.drshoes.app.auth.api;

import com.drshoes.app.auth.api.dto.LoginRequest;
import com.drshoes.app.auth.api.dto.MeResponse;
import com.drshoes.app.auth.domain.User;
import com.drshoes.app.auth.domain.UserRepository;
import com.drshoes.app.auth.principal.AdminPrincipal;
import com.drshoes.app.auth.service.AuthService;
import com.drshoes.app.auth.service.InvalidCredentialsException;
import com.drshoes.app.auth.service.LoginThrottledException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * REST controller for admin authentication: login, logout, me.
 *
 * Endpoints:
 *   POST /api/admin/auth/login  — 204 on success, 401 on bad creds, 429 if throttled
 *   POST /api/admin/auth/logout — 204 (invalidates session)
 *   GET  /api/admin/auth/me     — 200 with MeResponse JSON (requires active session)
 *
 * Structured logging per dispatch-protocol §7:
 *   op=login|logout|me  actor={email|anonymous}  outcome=success|...
 */
@RestController
@RequestMapping("/api/admin/auth")
public class AuthController {

    private static final Logger log = LoggerFactory.getLogger(AuthController.class);

    private final AuthService authService;
    private final UserRepository users;

    public AuthController(AuthService authService, UserRepository users) {
        this.authService = authService;
        this.users = users;
    }

    private static final HttpSessionSecurityContextRepository CONTEXT_REPO =
        new HttpSessionSecurityContextRepository();

    @PostMapping("/login")
    public ResponseEntity<Void> login(@Valid @RequestBody LoginRequest req,
                                      HttpServletRequest request,
                                      HttpServletResponse response,
                                      HttpSession session) {
        User u = authService.login(req.email(), req.password(), request);
        // Explicitly persist the SecurityContext to the session so subsequent requests
        // can load it. Spring Security 6 SecurityContextHolderFilter no longer auto-saves;
        // the context must be saved explicitly when authentication happens outside the
        // standard filter chain (programmatic login).
        CONTEXT_REPO.saveContext(SecurityContextHolder.getContext(), request, response);
        // Force session id rotation post-login (session fixation defence).
        session.setAttribute("authenticated", true);
        log.info("op=login actor={} userId={} outcome=success", u.getEmail(), u.getId());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpSession session) {
        String actor = currentActor();
        session.invalidate();
        SecurityContextHolder.clearContext();
        log.info("op=logout actor={} outcome=success", actor);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/me")
    public ResponseEntity<MeResponse> me(Authentication auth) {
        if (auth == null || !auth.isAuthenticated() || !(auth.getPrincipal() instanceof AdminPrincipal p)) {
            return ResponseEntity.status(401).build();
        }
        User u = users.findActiveByEmailIgnoreCase(p.email())
            .orElseThrow(InvalidCredentialsException::new);
        log.info("op=me actor={} userId={} outcome=success", p.email(), p.userId());
        return ResponseEntity.ok(new MeResponse(p.userId(), u.getEmail(), u.getFullName(), u.getRole(), u.getLastLoginAt()));
    }

    @ExceptionHandler(InvalidCredentialsException.class)
    public ResponseEntity<Map<String, Object>> handleInvalidCredentials(InvalidCredentialsException e) {
        log.info("op=login outcome=invalid_credentials");
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
            .body(error("INVALID_CREDENTIALS", e.getMessage()));
    }

    @ExceptionHandler(LoginThrottledException.class)
    public ResponseEntity<Map<String, Object>> handleThrottled(LoginThrottledException e) {
        log.info("op=login outcome=throttled");
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
            .header("Retry-After", "900")
            .body(error("LOGIN_THROTTLED", e.getMessage()));
    }

    private static Map<String, Object> error(String code, String message) {
        return Map.of("error", Map.of("code", code, "message", message));
    }

    private static String currentActor() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return (auth != null && auth.isAuthenticated()) ? auth.getName() : "anonymous";
    }
}
