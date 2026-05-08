package com.drshoes.app.auth.rbac;

import com.drshoes.app.auth.domain.UserRole;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Central RBAC decision service.
 * Referenced by SpEL in @PreAuthorize annotations as "@rbac".
 *
 * All decisions are logged at DEBUG to avoid per-request INFO spam.
 * Anonymous / null Authentication returns false for every capability.
 */
@Component("rbac")
public class RbacService {

    private static final Logger log = LoggerFactory.getLogger(RbacService.class);

    public boolean canEditOrder(Authentication auth) {
        return check(auth, "canEditOrder", UserRole.OWNER, UserRole.EMPLOYEE);
    }

    public boolean canDeleteOrders(Authentication auth) {
        return check(auth, "canDeleteOrders", UserRole.OWNER);
    }

    public boolean canManageStorageLocations(Authentication auth) {
        return check(auth, "canManageStorageLocations", UserRole.OWNER);
    }

    public boolean canEditTriggers(Authentication auth) {
        return check(auth, "canEditTriggers", UserRole.OWNER);
    }

    public boolean canEditTemplates(Authentication auth) {
        return check(auth, "canEditTemplates", UserRole.OWNER);
    }

    public boolean canManageUsers(Authentication auth) {
        return check(auth, "canManageUsers", UserRole.OWNER);
    }

    public boolean canRestoreOrder(Authentication auth) {
        return check(auth, "canRestoreOrder", UserRole.OWNER);
    }

    public boolean canManageClients(Authentication auth) {
        return check(auth, "canManageClients", UserRole.OWNER);
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    private boolean check(Authentication auth, String capability, UserRole... allowed) {
        // AnonymousAuthenticationToken.isAuthenticated() returns true in Spring Security 6,
        // so a plain `!isAuthenticated()` check would let anonymous principals through.
        // Reject explicitly via instanceof and only then fall back to isAuthenticated().
        if (auth == null || auth instanceof AnonymousAuthenticationToken || !auth.isAuthenticated()) {
            log.debug("op=rbacCheck capability={} actor=anonymous role=anonymous outcome=false", capability);
            return false;
        }
        Set<String> wanted = Arrays.stream(allowed)
            .map(r -> "ROLE_" + r.name())
            .collect(Collectors.toSet());
        boolean result = auth.getAuthorities().stream()
            .map(GrantedAuthority::getAuthority)
            .anyMatch(wanted::contains);
        log.debug("op=rbacCheck capability={} actor={} role={} outcome={}",
            capability, auth.getName(), extractRole(auth), result);
        return result;
    }

    private String extractRole(Authentication auth) {
        return auth.getAuthorities().stream()
            .map(GrantedAuthority::getAuthority)
            .filter(a -> a.startsWith("ROLE_"))
            .findFirst()
            .orElse("unknown");
    }
}
