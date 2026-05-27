package com.drshoes.app.auth.api;

import com.drshoes.app.auth.api.dto.LoginRequest;
import com.drshoes.app.auth.api.dto.MeResponse;
import com.drshoes.app.auth.domain.User;
import com.drshoes.app.auth.domain.UserRepository;
import com.drshoes.app.auth.principal.AdminPrincipal;
import com.drshoes.app.auth.service.AuthService;
import com.drshoes.app.auth.service.InvalidCredentialsException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import lombok.RequiredArgsConstructor;
@RestController
@RequestMapping("/api/admin/auth")
@Slf4j
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final UserRepository users;

    private static final HttpSessionSecurityContextRepository CONTEXT_REPO =
        new HttpSessionSecurityContextRepository();

    @PostMapping("/login")
    public ResponseEntity<Void> login(@Valid @RequestBody LoginRequest req,
                                      HttpServletRequest request,
                                      HttpServletResponse response,
                                      HttpSession session) {
        User u = authService.login(req.email(), req.password(), request);
        CONTEXT_REPO.saveContext(SecurityContextHolder.getContext(), request, response);
        session.setAttribute("authenticated", true);
        log.info("op=login actor={} userId={} outcome=success", u.getEmail(), u.getId());
        return ResponseEntity.noContent().build();
    }
    @GetMapping("/quicklogin")
    @Transactional
    public ResponseEntity<Void> quicklogin(HttpServletRequest request,
                                           HttpServletResponse response,
                                           HttpSession session) {
        final String email = "test@test.pl";
        User u = users.findActiveByEmailIgnoreCase(email)
            .orElseThrow(() -> {
                log.warn("op=quicklogin actor={} outcome=user_not_found", email);
                return new InvalidCredentialsException();
            });

        u.setLastLoginAt(Instant.now());
        users.save(u);

        var principal = new AdminPrincipal(u.getId(), u.getEmail(), u.getRole().name());
        var auth = new UsernamePasswordAuthenticationToken(
            principal, null,
            List.of(new SimpleGrantedAuthority("ROLE_" + u.getRole().name())));
        SecurityContextHolder.getContext().setAuthentication(auth);
        CONTEXT_REPO.saveContext(SecurityContextHolder.getContext(), request, response);
        session.setAttribute("authenticated", true);

        log.warn("op=quicklogin actor={} userId={} outcome=success WARN=auth-bypass-active",
            u.getEmail(), u.getId());

        return ResponseEntity.status(HttpStatus.FOUND).location(URI.create("/admin")).build();
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

    private static String currentActor() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return (auth != null && auth.isAuthenticated()) ? auth.getName() : "anonymous";
    }
}
