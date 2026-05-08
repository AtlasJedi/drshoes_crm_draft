package com.drshoes.app.auth.rbac;

import com.drshoes.app.auth.domain.UserRole;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class RbacServiceTest {

    private final RbacService rbac = new RbacService();

    private Authentication auth(UserRole role) {
        return new UsernamePasswordAuthenticationToken("x", null,
            List.of(new SimpleGrantedAuthority("ROLE_" + role.name())));
    }

    @Test
    void owner_can_do_everything() {
        var a = auth(UserRole.OWNER);
        assertThat(rbac.canDeleteOrders(a)).isTrue();
        assertThat(rbac.canEditTriggers(a)).isTrue();
        assertThat(rbac.canManageUsers(a)).isTrue();
        assertThat(rbac.canManageStorageLocations(a)).isTrue();
        assertThat(rbac.canEditOrder(a)).isTrue();
    }

    @Test
    void employee_cannot_delete_or_manage_settings() {
        var a = auth(UserRole.EMPLOYEE);
        assertThat(rbac.canDeleteOrders(a)).isFalse();
        assertThat(rbac.canEditTriggers(a)).isFalse();
        assertThat(rbac.canManageUsers(a)).isFalse();
        assertThat(rbac.canManageStorageLocations(a)).isFalse();
        assertThat(rbac.canEditOrder(a)).isTrue();   // employee can edit
    }

    @Test
    void anonymous_can_do_nothing() {
        assertThat(rbac.canDeleteOrders(null)).isFalse();
        assertThat(rbac.canEditTriggers(null)).isFalse();
    }

    @Test
    void canManageClients_owner_true_employee_false() {
        assertThat(rbac.canManageClients(auth(UserRole.OWNER))).isTrue();
        assertThat(rbac.canManageClients(auth(UserRole.EMPLOYEE))).isFalse();
        assertThat(rbac.canManageClients(null)).isFalse();
    }

    @Test
    void anonymous_token_is_rejected_even_though_isAuthenticated_is_true() {
        // Spring Security 6: AnonymousAuthenticationToken.isAuthenticated() == true.
        // Guard must reject it explicitly via instanceof, not via isAuthenticated().
        var anon = new AnonymousAuthenticationToken("key", "anonymousUser",
            List.of(new SimpleGrantedAuthority("ROLE_ANONYMOUS")));
        assertThat(anon.isAuthenticated()).isTrue();   // sanity: confirms the trap
        assertThat(rbac.canDeleteOrders(anon)).isFalse();
        assertThat(rbac.canEditOrder(anon)).isFalse();
        assertThat(rbac.canManageUsers(anon)).isFalse();
    }
}
