package com.drshoes.app.auth.domain;

import com.drshoes.app.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

class UserRepositoryIntegrationTest extends AbstractIntegrationTest {

    @Autowired UserRepository users;

    @Test
    void save_then_find_by_email_case_insensitive() {
        var u = new User();
        u.setEmail("misza@drshoes.pl");
        u.setPasswordHash("hash");
        u.setFullName("Misza Doctor");
        u.setRole(UserRole.OWNER);
        users.save(u);

        Optional<User> byUpper = users.findByEmailIgnoreCase("MISZA@drshoes.pl");
        assertThat(byUpper).isPresent();
        assertThat(byUpper.get().getRole()).isEqualTo(UserRole.OWNER);
    }

    @Test
    void email_uniqueness_enforced() {
        var a = new User();
        a.setEmail("dup@example.com"); a.setPasswordHash("h"); a.setFullName("A"); a.setRole(UserRole.EMPLOYEE);
        users.save(a);

        var b = new User();
        b.setEmail("dup@example.com"); b.setPasswordHash("h"); b.setFullName("B"); b.setRole(UserRole.EMPLOYEE);

        org.junit.jupiter.api.Assertions.assertThrows(
            org.springframework.dao.DataIntegrityViolationException.class,
            () -> users.saveAndFlush(b));
    }

    @Test
    void inactive_user_filtered_from_active_lookup() {
        var u = new User();
        u.setEmail("inactive@x.pl"); u.setPasswordHash("h"); u.setFullName("Inactive"); u.setRole(UserRole.EMPLOYEE);
        u.setActive(false);
        users.save(u);

        assertThat(users.findActiveByEmailIgnoreCase("inactive@x.pl")).isEmpty();
        assertThat(users.findByEmailIgnoreCase("inactive@x.pl")).isPresent();
    }
}
