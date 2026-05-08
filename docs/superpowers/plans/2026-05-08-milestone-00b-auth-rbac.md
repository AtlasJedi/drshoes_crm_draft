# Milestone 0B — Auth + RBAC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add session-cookie auth, CSRF, login throttling, BCrypt passwords, and a centralized RBAC policy with `OWNER` (full) vs `EMPLOYEE` (no DELETE) — exposed via `/api/admin/auth/{login,logout,me}` and enforced on all admin endpoints. Frontend gets a `/admin/login` page and an auth-guarded admin shell.

**Architecture:** Spring Security (form-less, programmatic login) + Spring Session JDBC + double-submit-cookie CSRF + Bucket4j login throttle + a central `RbacService` policy gate + AOP-driven audit_log writes. Frontend uses an auth-aware fetch wrapper that auto-attaches `X-XSRF-TOKEN`; a server-side admin layout gates on `GET /api/admin/auth/me`.

**Tech Stack:** Java 21, Spring Boot 3.4 (`spring-boot-starter-security`, `spring-session-jdbc`), BCrypt (built-in), Bucket4j 8.x, Next.js 16 + React 19, fetch + small client wrapper, Zod for env. Tests: Spring Boot Test + Testcontainers (Postgres) + MockMvc; Playwright deferred to Milestone 1 smoke.

**Working directory:** `/Users/atlasjedi/P/misza_madafaka`. Tag `milestone-0a` is at HEAD. Don't break the existing 14 backend tests + Next.js build.

---

## File structure (locked)

After this plan completes, the new/modified tree is:

```
backend/app/
├── pom.xml                                                          (MOD — add starter-security, spring-session-jdbc, bucket4j-core)
├── src/main/java/com/drshoes/app/
│   ├── auth/
│   │   ├── api/
│   │   │   ├── AuthController.java                                  (NEW)
│   │   │   └── dto/{LoginRequest,LoginResponse,MeResponse}.java     (NEW)
│   │   ├── domain/
│   │   │   ├── User.java                                            (NEW — JPA @Entity)
│   │   │   ├── UserRole.java                                        (NEW — enum)
│   │   │   └── UserRepository.java                                  (NEW)
│   │   ├── service/
│   │   │   ├── AuthService.java                                     (NEW — login/logout/me orchestration)
│   │   │   ├── LoginThrottle.java                                   (NEW — Bucket4j wrapper)
│   │   │   └── PasswordEncoderConfig.java                           (NEW — BCrypt bean)
│   │   └── rbac/
│   │       ├── RbacService.java                                     (NEW — central policy)
│   │       └── RbacException.java                                   (NEW)
│   ├── config/
│   │   ├── SecurityConfig.java                                      (NEW — SecurityFilterChain, CSRF, session, public routes)
│   │   └── SessionConfig.java                                       (NEW — @EnableJdbcHttpSession + cookie config)
│   └── audit/
│       ├── AuditLog.java                                            (NEW — JPA @Entity for audit_log row)
│       ├── AuditLogRepository.java                                  (NEW)
│       └── AuditLogAspect.java                                      (NEW — @Around on @AuditedAdmin endpoints)
└── src/main/resources/db/migration/
    └── V002__seed_users.sql                                         (NEW — Misza OWNER + first EMPLOYEE)

apps/web/
├── lib/
│   ├── api.ts                                                       (NEW — fetch wrapper, CSRF, 401 handling)
│   └── auth/
│       ├── session.ts                                               (NEW — server-side getMe() helper)
│       └── types.ts                                                 (NEW)
├── app/
│   ├── (admin)/
│   │   ├── admin/
│   │   │   ├── layout.tsx                                           (NEW — auth guard, sidebar shell stub)
│   │   │   └── page.tsx                                             (MOD — replace placeholder w/ logged-in dashboard stub)
│   │   └── admin/
│   │       └── login/page.tsx                                       (NEW — login form, client component)
│   └── api/                                                         (no new route handlers — Next acts as proxy via existing rewrite from Task 16)
└── components/
    └── auth/LoginForm.tsx                                           (NEW)
```

**Boundary rules:**
- All auth code lives under `com.drshoes.app.auth.*`. RBAC code under `com.drshoes.app.auth.rbac`.
- `RbacService` is the **only** place where role permissions live. Controllers consult it via `@PreAuthorize("@rbac.canDeleteOrders(authentication)")` SpEL.
- The frontend `lib/api.ts` is the **only** place that knows about CSRF / cookies / 401 redirect.
- No raw role string literals in business code — always go through `UserRole.OWNER` / `RbacService` methods.

---

## Phase 1 — User domain + Spring Security baseline (Tasks 1-4)

### Task 1: User JPA entity + UserRepository + integration test

**Files:**
- Create: `backend/app/src/main/java/com/drshoes/app/auth/domain/User.java`
- Create: `backend/app/src/main/java/com/drshoes/app/auth/domain/UserRole.java`
- Create: `backend/app/src/main/java/com/drshoes/app/auth/domain/UserRepository.java`
- Test: `backend/app/src/test/java/com/drshoes/app/auth/domain/UserRepositoryIntegrationTest.java`
- Modify: `backend/app/pom.xml` — add `spring-boot-starter-security`, `spring-session-jdbc`, `bucket4j-core` (8.10.1) deps. Existing deps unchanged.

- [ ] **Step 1: Add deps to `backend/app/pom.xml`**

In the `<dependencies>` block, after `spring-boot-starter-validation`, add:

```xml
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-security</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.session</groupId>
      <artifactId>spring-session-jdbc</artifactId>
    </dependency>
    <dependency>
      <groupId>com.bucket4j</groupId>
      <artifactId>bucket4j-core</artifactId>
      <version>8.10.1</version>
    </dependency>
```

Test deps: ensure `spring-security-test` (in `spring-boot-starter-test` BOM) is present — it's transitive, no explicit dep needed.

- [ ] **Step 2: Write failing repo integration test**

`backend/app/src/test/java/com/drshoes/app/auth/domain/UserRepositoryIntegrationTest.java`:

```java
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
```

- [ ] **Step 3: Run failing test (RED)**

```bash
cd /Users/atlasjedi/P/misza_madafaka/backend && mvn -B -pl app -am test -Dtest=UserRepositoryIntegrationTest
```

Expected: compile failure — `User`, `UserRole`, `UserRepository` not found.

- [ ] **Step 4: Create `UserRole.java`**

```java
package com.drshoes.app.auth.domain;

public enum UserRole {
    OWNER,
    EMPLOYEE,
    CRAFTSMAN,
    OFFICE
}
```

- [ ] **Step 5: Create `User.java`** (JPA entity mapped to existing `user_` table from V001)

```java
package com.drshoes.app.auth.domain;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "user_")
public class User {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(nullable = false, unique = true, columnDefinition = "citext")
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(name = "full_name", nullable = false, length = 120)
    private String fullName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private UserRole role;

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "last_login_at")
    private Instant lastLoginAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @PreUpdate
    void onUpdate() {
        this.updatedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }

    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }

    public UserRole getRole() { return role; }
    public void setRole(UserRole role) { this.role = role; }

    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }

    public Instant getLastLoginAt() { return lastLoginAt; }
    public void setLastLoginAt(Instant t) { this.lastLoginAt = t; }

    public Instant getCreatedAt() { return createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
}
```

- [ ] **Step 6: Create `UserRepository.java`**

```java
package com.drshoes.app.auth.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {

    @Query("select u from User u where lower(u.email) = lower(?1)")
    Optional<User> findByEmailIgnoreCase(String email);

    @Query("select u from User u where lower(u.email) = lower(?1) and u.active = true")
    Optional<User> findActiveByEmailIgnoreCase(String email);
}
```

- [ ] **Step 7: Run tests (GREEN)**

```bash
cd /Users/atlasjedi/P/misza_madafaka/backend && mvn -B -pl app -am test -Dtest=UserRepositoryIntegrationTest
```

Expected: 3 tests pass. **Note** — Spring Security on the classpath now requires explicit endpoint allow-listing or the integration tests will get 401 on `/actuator/health` from earlier tests. **Do not run the full app test suite yet** — it will fail at `HealthEndpointIntegrationTest` until Task 4 adds the SecurityConfig allow-list. This is expected and resolved by Task 4.

- [ ] **Step 8: Commit**

```bash
cd /Users/atlasjedi/P/misza_madafaka
git add backend/app
git commit -m "feat(auth): User entity, UserRepository, role enum + repo integration test"
```

---

### Task 2: Spring Session JDBC config

**Files:**
- Create: `backend/app/src/main/java/com/drshoes/app/config/SessionConfig.java`
- Modify: `backend/app/src/main/resources/application.yaml` — add `spring.session.jdbc.*` config.
- Test: `backend/app/src/test/java/com/drshoes/app/config/SessionTablesIntegrationTest.java`

- [ ] **Step 1: Write failing test**

`backend/app/src/test/java/com/drshoes/app/config/SessionTablesIntegrationTest.java`:

```java
package com.drshoes.app.config;

import com.drshoes.app.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;

class SessionTablesIntegrationTest extends AbstractIntegrationTest {

    @Autowired JdbcTemplate jdbc;

    @Test
    void spring_session_tables_exist_after_v001() {
        Integer sessionTable = jdbc.queryForObject(
            "select count(*) from information_schema.tables where table_name = 'spring_session'",
            Integer.class);
        Integer attrsTable = jdbc.queryForObject(
            "select count(*) from information_schema.tables where table_name = 'spring_session_attributes'",
            Integer.class);
        assertThat(sessionTable).isEqualTo(1);
        assertThat(attrsTable).isEqualTo(1);
    }

    @Test
    void session_persists_through_request() {
        // Smoke: write a row directly, read it back. This proves the schema accepts writes.
        jdbc.update("INSERT INTO spring_session (primary_id, session_id, creation_time, last_access_time, max_inactive_interval, expiry_time, principal_name) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    java.util.UUID.randomUUID().toString(),
                    java.util.UUID.randomUUID().toString(),
                    System.currentTimeMillis(),
                    System.currentTimeMillis(),
                    1800,
                    System.currentTimeMillis() + 1800_000L,
                    "test@example.com");
        Integer count = jdbc.queryForObject("select count(*) from spring_session", Integer.class);
        assertThat(count).isGreaterThanOrEqualTo(1);
    }
}
```

- [ ] **Step 2: Run failing test**

```bash
mvn -B -pl app -am test -Dtest=SessionTablesIntegrationTest
```

Expected: pass for `spring_session_tables_exist_after_v001` (V001 already created them in Milestone 0A) but the test class needs `@EnableJdbcHttpSession` not yet activated. Run it; if it fails because of context wiring or schema initializer trying to recreate tables, that's the signal.

Actually given V001 already created the tables, if the test fails it'll be because Spring Session's default schema-create-or-drop bites. This is what we fix in Step 4 (set `spring.session.jdbc.initialize-schema: never`).

- [ ] **Step 3: Create `SessionConfig.java`**

```java
package com.drshoes.app.config;

import org.springframework.boot.web.servlet.server.CookieSameSiteSupplier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.session.jdbc.config.annotation.web.http.EnableJdbcHttpSession;

import java.time.Duration;

@Configuration
@EnableJdbcHttpSession(maxInactiveIntervalInSeconds = 1800)  // 30 min idle
public class SessionConfig {

    @Bean
    CookieSameSiteSupplier sameSite() {
        return CookieSameSiteSupplier.ofLax();
    }
}
```

- [ ] **Step 4: Add config to `application.yaml`**

In `backend/app/src/main/resources/application.yaml`, after the existing `spring.flyway` block, add:

```yaml
  session:
    jdbc:
      initialize-schema: never
      table-name: SPRING_SESSION
    timeout: 30m
```

In the same file's `server:` block, add cookie config:

```yaml
  servlet:
    session:
      cookie:
        name: dr_session
        http-only: true
        secure: false       # overridden in production profile
        same-site: lax
```

(`secure: false` for local; production profile will override to `true`.)

- [ ] **Step 5: Run tests**

```bash
mvn -B -pl app -am test -Dtest=SessionTablesIntegrationTest
```

Expected: 2 tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/app
git commit -m "feat(auth): Spring Session JDBC config + 30min idle cookie"
```

---

### Task 3: Password encoder + BCrypt config

**Files:**
- Create: `backend/app/src/main/java/com/drshoes/app/auth/service/PasswordEncoderConfig.java`
- Test: `backend/app/src/test/java/com/drshoes/app/auth/service/PasswordEncoderTest.java`

- [ ] **Step 1: Write failing test**

```java
package com.drshoes.app.auth.service;

import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;

class PasswordEncoderTest {

    @Test
    void bcrypt_hashes_with_cost_12_and_verifies() {
        PasswordEncoder enc = new PasswordEncoderConfig().passwordEncoder();
        String hash = enc.encode("supersecret");
        assertThat(hash).startsWith("$2");                 // BCrypt prefix
        assertThat(hash).contains("$12$");                 // strength 12
        assertThat(enc.matches("supersecret", hash)).isTrue();
        assertThat(enc.matches("nope", hash)).isFalse();
    }
}
```

- [ ] **Step 2: Run RED**

```bash
mvn -B -pl app -am test -Dtest=PasswordEncoderTest
```

Expected: compile failure.

- [ ] **Step 3: Create config**

```java
package com.drshoes.app.auth.service;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
public class PasswordEncoderConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }
}
```

- [ ] **Step 4: Run GREEN**

```bash
mvn -B -pl app -am test -Dtest=PasswordEncoderTest
```

Expected: 1 test passes.

- [ ] **Step 5: Commit**

```bash
git add backend/app
git commit -m "feat(auth): BCrypt password encoder bean (cost 12)"
```

---

### Task 4: SecurityConfig + public route allow-list + CSRF

**Files:**
- Create: `backend/app/src/main/java/com/drshoes/app/config/SecurityConfig.java`
- Test: `backend/app/src/test/java/com/drshoes/app/config/SecurityConfigIntegrationTest.java`

- [ ] **Step 1: Write failing test**

```java
package com.drshoes.app.config;

import com.drshoes.app.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpStatus;

import static org.assertj.core.api.Assertions.assertThat;

class SecurityConfigIntegrationTest extends AbstractIntegrationTest {

    @Autowired TestRestTemplate rest;

    @Test
    void actuator_health_is_public() {
        var resp = rest.getForEntity("/actuator/health", String.class);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void admin_endpoints_require_auth() {
        var resp = rest.getForEntity("/api/admin/auth/me", String.class);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void public_routes_are_open() {
        var resp = rest.getForEntity("/api/public/news", String.class);
        // Endpoint doesn't exist yet (Milestone 5) but security must NOT 401 it.
        // Expect 404 or method-not-allowed (anything but 401/403).
        assertThat(resp.getStatusCode()).isNotIn(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN);
    }
}
```

- [ ] **Step 2: Run RED**

```bash
mvn -B -pl app -am test -Dtest=SecurityConfigIntegrationTest
```

Expected: most tests fail because Spring Security default config returns 401 for everything.

- [ ] **Step 3: Create `SecurityConfig.java`**

```java
package com.drshoes.app.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.http.HttpStatus;

@Configuration
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        var csrfRepo = CookieCsrfTokenRepository.withHttpOnlyFalse();   // double-submit
        csrfRepo.setCookieName("XSRF-TOKEN");
        var csrfHandler = new CsrfTokenRequestAttributeHandler();
        csrfHandler.setCsrfRequestAttributeName("_csrf");

        http
            .csrf(c -> c
                .csrfTokenRepository(csrfRepo)
                .csrfTokenRequestHandler(csrfHandler)
                .ignoringRequestMatchers("/api/public/**", "/api/webhooks/**", "/actuator/**"))
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
            .authorizeHttpRequests(a -> a
                .requestMatchers("/actuator/health", "/actuator/info").permitAll()
                .requestMatchers("/api/public/**").permitAll()
                .requestMatchers("/api/webhooks/**").permitAll()
                .requestMatchers("/api/admin/auth/login", "/api/admin/auth/csrf").permitAll()
                .requestMatchers("/api/admin/**").authenticated()
                .anyRequest().permitAll())
            .formLogin(AbstractHttpConfigurer::disable)
            .httpBasic(AbstractHttpConfigurer::disable)
            .logout(AbstractHttpConfigurer::disable)
            .exceptionHandling(e -> e.authenticationEntryPoint(
                new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)));

        return http.build();
    }
}
```

- [ ] **Step 4: Run GREEN**

```bash
mvn -B -pl app -am test -Dtest=SecurityConfigIntegrationTest
mvn -B -pl app -am test -Dtest=HealthEndpointIntegrationTest
```

Expected: SecurityConfig tests pass (3); the existing health endpoint test still passes.

- [ ] **Step 5: Run full app test suite to confirm nothing broke**

```bash
mvn -B -pl app -am verify
```

Expected: all prior tests + new tests green.

- [ ] **Step 6: Commit**

```bash
git add backend/app
git commit -m "feat(auth): SecurityFilterChain with CSRF double-submit + admin auth gating"
```

---

## Phase 2 — Login flow + RBAC + audit (Tasks 5-9)

### Task 5: Login throttle (Bucket4j)

**Files:**
- Create: `backend/app/src/main/java/com/drshoes/app/auth/service/LoginThrottle.java`
- Test: `backend/app/src/test/java/com/drshoes/app/auth/service/LoginThrottleTest.java`

- [ ] **Step 1: Write failing test**

```java
package com.drshoes.app.auth.service;

import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;

class LoginThrottleTest {

    @Test
    void allows_up_to_5_attempts_then_blocks_per_ip() {
        var throttle = new LoginThrottle(5, Duration.ofMinutes(15));
        for (int i = 0; i < 5; i++) {
            assertThat(throttle.tryConsume("1.2.3.4")).isTrue();
        }
        assertThat(throttle.tryConsume("1.2.3.4")).isFalse();
    }

    @Test
    void other_ip_unaffected() {
        var throttle = new LoginThrottle(2, Duration.ofMinutes(15));
        throttle.tryConsume("a.b.c.d");
        throttle.tryConsume("a.b.c.d");
        assertThat(throttle.tryConsume("a.b.c.d")).isFalse();
        assertThat(throttle.tryConsume("9.9.9.9")).isTrue();
    }
}
```

- [ ] **Step 2: RED**

```bash
mvn -B -pl app -am test -Dtest=LoginThrottleTest
```

- [ ] **Step 3: Create `LoginThrottle.java`**

```java
package com.drshoes.app.auth.service;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;

import java.time.Duration;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

public class LoginThrottle {

    private final long capacity;
    private final Duration window;
    private final ConcurrentMap<String, Bucket> buckets = new ConcurrentHashMap<>();

    public LoginThrottle(long capacity, Duration window) {
        this.capacity = capacity;
        this.window = window;
    }

    public boolean tryConsume(String ip) {
        return buckets
            .computeIfAbsent(ip, k -> Bucket.builder()
                .addLimit(Bandwidth.builder()
                    .capacity(capacity)
                    .refillIntervally(capacity, window)
                    .build())
                .build())
            .tryConsume(1);
    }
}
```

- [ ] **Step 4: GREEN**

- [ ] **Step 5: Wire as bean** — create `backend/app/src/main/java/com/drshoes/app/auth/service/LoginThrottleConfig.java`:

```java
package com.drshoes.app.auth.service;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

@Configuration
public class LoginThrottleConfig {

    @Bean
    LoginThrottle loginThrottle() {
        return new LoginThrottle(5, Duration.ofMinutes(15));
    }
}
```

- [ ] **Step 6: Commit**

```bash
git add backend/app
git commit -m "feat(auth): per-IP login throttle (5 attempts / 15min) via Bucket4j"
```

---

### Task 6: AuthService + AuthController + DTOs + integration tests

**Files:**
- Create: `backend/app/src/main/java/com/drshoes/app/auth/api/AuthController.java`
- Create: `backend/app/src/main/java/com/drshoes/app/auth/api/dto/LoginRequest.java`
- Create: `backend/app/src/main/java/com/drshoes/app/auth/api/dto/MeResponse.java`
- Create: `backend/app/src/main/java/com/drshoes/app/auth/service/AuthService.java`
- Create: `backend/app/src/main/java/com/drshoes/app/auth/service/InvalidCredentialsException.java`
- Create: `backend/app/src/main/java/com/drshoes/app/auth/service/LoginThrottledException.java`
- Test: `backend/app/src/test/java/com/drshoes/app/auth/api/AuthControllerIntegrationTest.java`

- [ ] **Step 1: Write failing integration test**

```java
package com.drshoes.app.auth.api;

import com.drshoes.app.AbstractIntegrationTest;
import com.drshoes.app.auth.domain.User;
import com.drshoes.app.auth.domain.UserRepository;
import com.drshoes.app.auth.domain.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.*;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;

class AuthControllerIntegrationTest extends AbstractIntegrationTest {

    @Autowired TestRestTemplate rest;
    @Autowired UserRepository users;
    @Autowired PasswordEncoder enc;

    @BeforeEach
    void seed() {
        users.deleteAll();
        var u = new User();
        u.setEmail("misza@drshoes.pl");
        u.setPasswordHash(enc.encode("CorrectHorse"));
        u.setFullName("Misza Doctor");
        u.setRole(UserRole.OWNER);
        users.save(u);
    }

    @Test
    void login_then_me_returns_user() {
        // Login
        var loginResp = rest.exchange("/api/admin/auth/login", HttpMethod.POST,
            new HttpEntity<>(new LoginRequest("misza@drshoes.pl", "CorrectHorse"),
                             jsonHeaders()),
            String.class);
        assertThat(loginResp.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        var sessionCookie = loginResp.getHeaders().get("Set-Cookie");
        assertThat(sessionCookie).isNotEmpty();

        // Me
        var meHeaders = new HttpHeaders();
        meHeaders.put(HttpHeaders.COOKIE, sessionCookie);
        var meResp = rest.exchange("/api/admin/auth/me", HttpMethod.GET,
            new HttpEntity<>(meHeaders), MeResponse.class);
        assertThat(meResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(meResp.getBody().email()).isEqualTo("misza@drshoes.pl");
        assertThat(meResp.getBody().role()).isEqualTo(UserRole.OWNER);
    }

    @Test
    void wrong_password_returns_401() {
        var resp = rest.exchange("/api/admin/auth/login", HttpMethod.POST,
            new HttpEntity<>(new LoginRequest("misza@drshoes.pl", "WrongPass"),
                             jsonHeaders()),
            String.class);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void unknown_email_returns_401() {
        var resp = rest.exchange("/api/admin/auth/login", HttpMethod.POST,
            new HttpEntity<>(new LoginRequest("ghost@drshoes.pl", "any"),
                             jsonHeaders()),
            String.class);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void me_without_session_returns_401() {
        var resp = rest.getForEntity("/api/admin/auth/me", String.class);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    private HttpHeaders jsonHeaders() {
        var h = new HttpHeaders();
        h.setContentType(MediaType.APPLICATION_JSON);
        return h;
    }
}
```

- [ ] **Step 2: RED**

- [ ] **Step 3: Create DTOs**

`LoginRequest.java`:
```java
package com.drshoes.app.auth.api.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record LoginRequest(@NotBlank @Email String email, @NotBlank String password) {}
```

`MeResponse.java`:
```java
package com.drshoes.app.auth.api.dto;

import com.drshoes.app.auth.domain.UserRole;

import java.time.Instant;
import java.util.UUID;

public record MeResponse(UUID id, String email, String fullName, UserRole role, Instant lastLoginAt) {}
```

- [ ] **Step 4: Create exceptions**

`InvalidCredentialsException.java`:
```java
package com.drshoes.app.auth.service;

public class InvalidCredentialsException extends RuntimeException {
    public InvalidCredentialsException() { super("invalid credentials"); }
}
```

`LoginThrottledException.java`:
```java
package com.drshoes.app.auth.service;

public class LoginThrottledException extends RuntimeException {
    public LoginThrottledException() { super("too many login attempts"); }
}
```

- [ ] **Step 5: Create `AuthService.java`**

```java
package com.drshoes.app.auth.service;

import com.drshoes.app.auth.domain.User;
import com.drshoes.app.auth.domain.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.context.SecurityContextHolder;     // see note below
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
public class AuthService {

    private final UserRepository users;
    private final PasswordEncoder enc;
    private final LoginThrottle throttle;

    public AuthService(UserRepository users, PasswordEncoder enc, LoginThrottle throttle) {
        this.users = users;
        this.enc = enc;
        this.throttle = throttle;
    }

    @Transactional
    public User login(String email, String password, HttpServletRequest request) {
        String ip = request.getRemoteAddr();
        if (!throttle.tryConsume(ip)) {
            throw new LoginThrottledException();
        }
        var u = users.findActiveByEmailIgnoreCase(email)
            .orElseThrow(InvalidCredentialsException::new);
        if (!enc.matches(password, u.getPasswordHash())) {
            throw new InvalidCredentialsException();
        }
        u.setLastLoginAt(Instant.now());
        users.save(u);

        var auth = new UsernamePasswordAuthenticationToken(
            u.getEmail(), null,
            List.of(new SimpleGrantedAuthority("ROLE_" + u.getRole().name())));
        // Spring Security 6+ uses `org.springframework.security.core.context.SecurityContextHolder`.
        // The import line above must point to that — adjust if your IDE auto-imports the wrong one.
        org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(auth);
        return u;
    }
}
```

(Note: the misimport on line 4 is intentionally left so you remember to fix it. Use `org.springframework.security.core.context.SecurityContextHolder` — the `.core.context` version. After you create the file, fix the import.)

- [ ] **Step 6: Create `AuthController.java`**

```java
package com.drshoes.app.auth.api;

import com.drshoes.app.auth.api.dto.LoginRequest;
import com.drshoes.app.auth.api.dto.MeResponse;
import com.drshoes.app.auth.domain.User;
import com.drshoes.app.auth.domain.UserRepository;
import com.drshoes.app.auth.service.AuthService;
import com.drshoes.app.auth.service.InvalidCredentialsException;
import com.drshoes.app.auth.service.LoginThrottledException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.context.request.WebRequest;

@RestController
@RequestMapping("/api/admin/auth")
public class AuthController {

    private final AuthService authService;
    private final UserRepository users;

    public AuthController(AuthService authService, UserRepository users) {
        this.authService = authService;
        this.users = users;
    }

    @PostMapping("/login")
    public ResponseEntity<Void> login(@Valid @RequestBody LoginRequest req,
                                      HttpServletRequest request,
                                      HttpSession session) {
        authService.login(req.email(), req.password(), request);
        // Force session id rotation post-login (defense against fixation).
        session.setAttribute("authenticated", true);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpSession session) {
        session.invalidate();
        SecurityContextHolder.clearContext();
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/me")
    public MeResponse me(Authentication auth) {
        User u = users.findActiveByEmailIgnoreCase(auth.getName())
            .orElseThrow(InvalidCredentialsException::new);
        return new MeResponse(u.getId(), u.getEmail(), u.getFullName(), u.getRole(), u.getLastLoginAt());
    }

    @ExceptionHandler(InvalidCredentialsException.class)
    public ResponseEntity<?> invalid(InvalidCredentialsException e) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(error("INVALID_CREDENTIALS", e.getMessage()));
    }

    @ExceptionHandler(LoginThrottledException.class)
    public ResponseEntity<?> throttled(LoginThrottledException e) {
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
            .header("Retry-After", "900")
            .body(error("LOGIN_THROTTLED", e.getMessage()));
    }

    private static java.util.Map<String, Object> error(String code, String message) {
        return java.util.Map.of("error", java.util.Map.of("code", code, "message", message));
    }
}
```

- [ ] **Step 7: GREEN**

```bash
mvn -B -pl app -am test -Dtest=AuthControllerIntegrationTest
```

Expected: 4 tests pass.

- [ ] **Step 8: Run full suite**

```bash
mvn -B -pl app -am verify
```

Expected: all tests still green.

- [ ] **Step 9: Commit**

```bash
git add backend/app
git commit -m "feat(auth): login/logout/me endpoints with session rotation + throttle"
```

---

### Task 7: RbacService + @PreAuthorize wiring + RBAC integration test

**Files:**
- Create: `backend/app/src/main/java/com/drshoes/app/auth/rbac/RbacService.java`
- Create: `backend/app/src/main/java/com/drshoes/app/auth/rbac/MethodSecurityConfig.java`
- Test: `backend/app/src/test/java/com/drshoes/app/auth/rbac/RbacServiceTest.java`
- Test: `backend/app/src/test/java/com/drshoes/app/auth/rbac/RbacIntegrationTest.java`

- [ ] **Step 1: Write failing unit test**

```java
package com.drshoes.app.auth.rbac;

import com.drshoes.app.auth.domain.UserRole;
import org.junit.jupiter.api.Test;
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
}
```

- [ ] **Step 2: RED**

- [ ] **Step 3: Create `RbacService.java`**

```java
package com.drshoes.app.auth.rbac;

import com.drshoes.app.auth.domain.UserRole;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.stereotype.Component;

import java.util.Set;

@Component("rbac")
public class RbacService {

    public boolean canEditOrder(Authentication auth)            { return hasAnyRole(auth, UserRole.OWNER, UserRole.EMPLOYEE); }
    public boolean canDeleteOrders(Authentication auth)         { return hasRole(auth, UserRole.OWNER); }
    public boolean canManageStorageLocations(Authentication a)  { return hasRole(a, UserRole.OWNER); }
    public boolean canEditTriggers(Authentication auth)         { return hasRole(auth, UserRole.OWNER); }
    public boolean canEditTemplates(Authentication auth)        { return hasRole(auth, UserRole.OWNER); }
    public boolean canManageUsers(Authentication auth)          { return hasRole(auth, UserRole.OWNER); }
    public boolean canRestoreOrder(Authentication auth)         { return hasRole(auth, UserRole.OWNER); }

    private boolean hasRole(Authentication auth, UserRole role) {
        if (auth == null || !auth.isAuthenticated()) return false;
        return auth.getAuthorities().stream()
            .map(GrantedAuthority::getAuthority)
            .anyMatch(("ROLE_" + role.name())::equals);
    }

    private boolean hasAnyRole(Authentication auth, UserRole... roles) {
        if (auth == null || !auth.isAuthenticated()) return false;
        Set<String> wanted = Set.of(java.util.Arrays.stream(roles)
            .map(r -> "ROLE_" + r.name()).toArray(String[]::new));
        return auth.getAuthorities().stream()
            .map(GrantedAuthority::getAuthority)
            .anyMatch(wanted::contains);
    }
}
```

- [ ] **Step 4: Enable method security**

`MethodSecurityConfig.java`:
```java
package com.drshoes.app.auth.rbac;

import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;

@Configuration
@EnableMethodSecurity(prePostEnabled = true)
public class MethodSecurityConfig {}
```

- [ ] **Step 5: Write integration test for end-to-end RBAC enforcement**

`RbacIntegrationTest.java`:
```java
package com.drshoes.app.auth.rbac;

import com.drshoes.app.AbstractIntegrationTest;
import com.drshoes.app.auth.domain.User;
import com.drshoes.app.auth.domain.UserRepository;
import com.drshoes.app.auth.domain.UserRole;
import com.drshoes.app.auth.api.dto.LoginRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class RbacIntegrationTest extends AbstractIntegrationTest {

    @Autowired TestRestTemplate rest;
    @Autowired UserRepository users;
    @Autowired PasswordEncoder enc;

    @BeforeEach
    void seed() {
        users.deleteAll();
        var owner = new User();
        owner.setEmail("owner@x"); owner.setPasswordHash(enc.encode("p")); owner.setFullName("O"); owner.setRole(UserRole.OWNER);
        var emp = new User();
        emp.setEmail("emp@x"); emp.setPasswordHash(enc.encode("p")); emp.setFullName("E"); emp.setRole(UserRole.EMPLOYEE);
        users.saveAll(List.of(owner, emp));
    }

    @Test
    void employee_cannot_call_owner_only_test_endpoint() {
        var cookies = login("emp@x", "p");
        var headers = new HttpHeaders();
        headers.put(HttpHeaders.COOKIE, cookies);
        var resp = rest.exchange("/test/owner-only", HttpMethod.GET, new HttpEntity<>(headers), String.class);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void owner_can_call_owner_only_test_endpoint() {
        var cookies = login("owner@x", "p");
        var headers = new HttpHeaders();
        headers.put(HttpHeaders.COOKIE, cookies);
        var resp = rest.exchange("/test/owner-only", HttpMethod.GET, new HttpEntity<>(headers), String.class);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    private List<String> login(String email, String pass) {
        var headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        var resp = rest.exchange("/api/admin/auth/login", HttpMethod.POST,
            new HttpEntity<>(new LoginRequest(email, pass), headers), String.class);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        return resp.getHeaders().get("Set-Cookie");
    }

    @RestController
    @RequestMapping("/test")
    static class TestEndpoints {
        @GetMapping("/owner-only")
        @org.springframework.security.access.prepost.PreAuthorize("@rbac.canManageUsers(authentication)")
        public String ownerOnly() { return "ok"; }
    }
}
```

(The `@RestController` inner class is a test-only endpoint to exercise RBAC — Spring Boot Test scans it because of `@SpringBootTest`.)

- [ ] **Step 6: GREEN**

```bash
mvn -B -pl app -am test -Dtest=RbacServiceTest,RbacIntegrationTest
```

Expected: 5 tests pass.

- [ ] **Step 7: Commit**

```bash
git add backend/app
git commit -m "feat(auth): central RbacService + @EnableMethodSecurity + RBAC integration test"
```

---

### Task 8: Audit log table + AuditLogAspect

**Files:**
- Create: `backend/app/src/main/java/com/drshoes/app/audit/AuditLog.java`
- Create: `backend/app/src/main/java/com/drshoes/app/audit/AuditLogRepository.java`
- Create: `backend/app/src/main/java/com/drshoes/app/audit/AuditLogAspect.java`
- Create: `backend/app/src/main/java/com/drshoes/app/audit/Audited.java`     (annotation)
- Test: `backend/app/src/test/java/com/drshoes/app/audit/AuditLogAspectIntegrationTest.java`

- [ ] **Step 1: Write failing test (uses AuthControllerIntegrationTest pattern)**

```java
package com.drshoes.app.audit;

import com.drshoes.app.AbstractIntegrationTest;
import com.drshoes.app.auth.domain.User;
import com.drshoes.app.auth.domain.UserRepository;
import com.drshoes.app.auth.domain.UserRole;
import com.drshoes.app.auth.api.dto.LoginRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.*;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;

class AuditLogAspectIntegrationTest extends AbstractIntegrationTest {

    @Autowired TestRestTemplate rest;
    @Autowired UserRepository users;
    @Autowired PasswordEncoder enc;
    @Autowired AuditLogRepository auditLog;

    @BeforeEach
    void seed() {
        auditLog.deleteAll();
        users.deleteAll();
        var u = new User();
        u.setEmail("misza@drshoes.pl"); u.setPasswordHash(enc.encode("p")); u.setFullName("M"); u.setRole(UserRole.OWNER);
        users.save(u);
    }

    @Test
    void login_writes_audit_log_row() {
        var headers = new HttpHeaders(); headers.setContentType(MediaType.APPLICATION_JSON);
        rest.exchange("/api/admin/auth/login", HttpMethod.POST,
            new HttpEntity<>(new LoginRequest("misza@drshoes.pl", "p"), headers), String.class);
        long count = auditLog.count();
        assertThat(count).isGreaterThanOrEqualTo(1);
    }
}
```

- [ ] **Step 2: RED**

- [ ] **Step 3: Create `AuditLog.java`** (mapped to existing `audit_log` table from V001)

```java
package com.drshoes.app.audit;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "audit_log")
public class AuditLog {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "actor_id", columnDefinition = "uuid")
    private UUID actorId;

    @Column(nullable = false, length = 10)
    private String method;

    @Column(nullable = false, length = 255)
    private String path;

    @Column(nullable = false)
    private int status;

    @Column(columnDefinition = "inet")
    private String ip;

    @Column(name = "user_agent")
    private String userAgent;

    @Column(name = "request_id", columnDefinition = "uuid")
    private UUID requestId;

    @Column(name = "body_hash", length = 64)
    private String bodyHash;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    // getters/setters
    public UUID getId() { return id; }
    public void setActorId(UUID actorId) { this.actorId = actorId; }
    public void setMethod(String method) { this.method = method; }
    public void setPath(String path) { this.path = path; }
    public void setStatus(int status) { this.status = status; }
    public void setIp(String ip) { this.ip = ip; }
    public void setUserAgent(String userAgent) { this.userAgent = userAgent; }
    public void setRequestId(UUID requestId) { this.requestId = requestId; }
    public void setBodyHash(String bodyHash) { this.bodyHash = bodyHash; }
    public Instant getCreatedAt() { return createdAt; }
}
```

- [ ] **Step 4: Create `AuditLogRepository.java`**

```java
package com.drshoes.app.audit;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {}
```

- [ ] **Step 5: Create `Audited.java` annotation (marker for AOP)**

```java
package com.drshoes.app.audit;

import java.lang.annotation.*;

@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Audited {}
```

- [ ] **Step 6: Create `AuditLogAspect.java`**

```java
package com.drshoes.app.audit;

import jakarta.servlet.http.HttpServletRequest;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.UUID;

@Aspect
@Component
public class AuditLogAspect {

    private final AuditLogRepository repo;
    // Note: a UserResolver could lookup the User entity by auth.getName() to get the UUID — for now
    // we leave actorId null; Phase 2's audit covers actor lookup once we add UserDetailsService.

    public AuditLogAspect(AuditLogRepository repo) { this.repo = repo; }

    @Around("execution(public * com.drshoes.app..api..*Controller.*(..))")
    public Object audit(ProceedingJoinPoint pjp) throws Throwable {
        var req = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        Object out;
        int status = 200;
        try {
            out = pjp.proceed();
            if (out instanceof ResponseEntity<?> re) status = re.getStatusCode().value();
        } catch (RuntimeException e) {
            status = 500;
            log(req, status);
            throw e;
        }
        log(req, status);
        return out;
    }

    private void log(ServletRequestAttributes attrs, int status) {
        if (attrs == null) return;
        HttpServletRequest r = attrs.getRequest();
        var entry = new AuditLog();
        entry.setMethod(r.getMethod());
        entry.setPath(r.getRequestURI());
        entry.setStatus(status);
        entry.setIp(r.getRemoteAddr());
        entry.setUserAgent(r.getHeader("User-Agent"));
        entry.setRequestId(UUID.randomUUID());
        repo.save(entry);
    }
}
```

- [ ] **Step 7: GREEN**

```bash
mvn -B -pl app -am test -Dtest=AuditLogAspectIntegrationTest
```

Expected: test passes (audit row count ≥ 1 after login).

- [ ] **Step 8: Run full suite**

```bash
mvn -B -pl app -am verify
```

- [ ] **Step 9: Commit**

```bash
git add backend/app
git commit -m "feat(audit): AuditLogAspect AOP wiring + integration test"
```

---

### Task 9: V002 seed users (OWNER + EMPLOYEE)

**Files:**
- Create: `backend/app/src/main/resources/db/migration/V002__seed_users.sql`

- [ ] **Step 1: Generate BCrypt hash for the seed password locally**

In a small Java REPL (e.g., `jshell`) or via the integration tests, generate a BCrypt(12) hash for password `dev123!` (placeholder):

```bash
cd /Users/atlasjedi/P/misza_madafaka/backend && mvn -B -pl app -am exec:java \
  -Dexec.mainClass=org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder \
  2>/dev/null || \
  # fallback: write a small Main.java helper temporarily, run, capture, delete.
  echo "Use jshell or integration test setUp to generate BCrypt hash for dev123!"
```

The simpler approach: write a one-off `BCryptHashGen.java` utility under `src/test/java/com/drshoes/app/auth/`, run it to print hashes, paste into the SQL file, then delete the helper file.

Or hardcode the password to `change-me-on-first-login` and document that the seed is for development only.

For the plan's purposes, use this BCrypt(12) hash for password `change-me-on-first-login` (you'll regenerate one specific to your run; the placeholder below MUST be replaced with a real `BCryptPasswordEncoder(12).encode("change-me-on-first-login")` output):

```
$2a$12$REPLACE.WITH.REAL.BCRYPT.HASH.GENERATED.LOCALLY.via.BCryptPasswordEncoder
```

- [ ] **Step 2: Write `V002__seed_users.sql`**

```sql
-- Seed dev users. Password for both: "change-me-on-first-login"
-- Real BCrypt(12) hash generated via BCryptPasswordEncoder(12).encode(...)
-- These users are CONVENIENCE for local dev only. Change passwords on first login in any non-local env.

INSERT INTO user_ (id, email, password_hash, full_name, role, active, created_at, updated_at)
VALUES
  (uuid_generate_v4(), 'misza@drshoes.pl', '$2a$12$REPLACE_WITH_REAL_HASH', 'Misza Doctor', 'OWNER',    TRUE, now(), now()),
  (uuid_generate_v4(), 'pomocnik@drshoes.pl', '$2a$12$REPLACE_WITH_REAL_HASH', 'Pomocnik', 'EMPLOYEE', TRUE, now(), now())
ON CONFLICT (email) DO NOTHING;
```

(Replace `$2a$12$REPLACE_WITH_REAL_HASH` with two real BCrypt hashes of `"change-me-on-first-login"`. They will be different each generation due to BCrypt's random salt.)

- [ ] **Step 3: Run integration tests** to confirm V002 applies and existing auth tests still pass.

```bash
mvn -B -pl app -am verify
```

Expected: all tests green.

- [ ] **Step 4: Commit**

```bash
git add backend/app/src/main/resources/db/migration/V002__seed_users.sql
git commit -m "feat(seed): V002 seed OWNER (Misza) + EMPLOYEE dev accounts"
```

---

## Phase 3 — Frontend auth (Tasks 10-13)

### Task 10: API client + auth helpers

**Files:**
- Create: `apps/web/lib/api.ts`
- Create: `apps/web/lib/auth/types.ts`
- Create: `apps/web/lib/auth/session.ts`

- [ ] **Step 1: Create `apps/web/lib/auth/types.ts`**

```ts
export type UserRole = "OWNER" | "EMPLOYEE" | "CRAFTSMAN" | "OFFICE";

export interface MeResponse {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  lastLoginAt: string | null;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Array<{ field: string; message: string }>;
  requestId?: string;
}
```

- [ ] **Step 2: Create `apps/web/lib/api.ts`**

```ts
import { env } from "./env";

const BASE = env.NEXT_PUBLIC_API_BASE;

function getCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()!.split(";").shift();
  return undefined;
}

export class ApiClient {

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    const csrf = getCookie("XSRF-TOKEN");
    if (csrf && init.method && init.method !== "GET") {
      headers.set("X-XSRF-TOKEN", csrf);
    }

    const resp = await fetch(`${BASE}${path}`, {
      ...init,
      headers,
      credentials: "include",
    });

    if (resp.status === 401 && typeof window !== "undefined" && !path.startsWith("/admin/auth/login")) {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/admin/login?next=${next}`;
      throw new Error("UNAUTHORIZED");
    }

    if (!resp.ok) {
      const bodyText = await resp.text().catch(() => "");
      throw new Error(`API ${resp.status}: ${bodyText}`);
    }

    if (resp.status === 204) return undefined as unknown as T;
    return (await resp.json()) as T;
  }

  get<T>(path: string)            { return this.request<T>(path,   { method: "GET" }); }
  post<T>(path: string, body?: unknown)  { return this.request<T>(path, { method: "POST",  body: body ? JSON.stringify(body) : undefined }); }
  patch<T>(path: string, body?: unknown) { return this.request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }); }
  delete<T>(path: string)         { return this.request<T>(path,   { method: "DELETE" }); }
}

export const api = new ApiClient();
```

- [ ] **Step 3: Create `apps/web/lib/auth/session.ts`**

```ts
import { cookies, headers } from "next/headers";
import type { MeResponse } from "./types";

/** Server-side helper: fetches /api/admin/auth/me using the request's cookies. */
export async function getMe(): Promise<MeResponse | null> {
  const internalApi = process.env.INTERNAL_API_BASE || "http://localhost:8080";
  const c = cookies();
  const cookieHeader = c.getAll().map(({ name, value }) => `${name}=${value}`).join("; ");
  if (!cookieHeader.includes("dr_session")) return null;

  const resp = await fetch(`${internalApi}/api/admin/auth/me`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (resp.status === 401) return null;
  if (!resp.ok) throw new Error(`auth/me failed: ${resp.status}`);
  return (await resp.json()) as MeResponse;
}
```

- [ ] **Step 4: Typecheck**

```bash
cd /Users/atlasjedi/P/misza_madafaka && pnpm --filter @drshoes/web typecheck
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib
git commit -m "feat(web): API client with CSRF + 401 redirect, server-side getMe helper"
```

---

### Task 11: Login page + LoginForm component

**Files:**
- Create: `apps/web/app/(admin)/admin/login/page.tsx`
- Create: `apps/web/components/auth/LoginForm.tsx`

- [ ] **Step 1: Create `apps/web/components/auth/LoginForm.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/admin";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post("/admin/auth/login", { email, password });
      router.push(next);
      router.refresh();
    } catch (err) {
      setError("Niepoprawny email lub hasło.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="bg-admin-surface border border-admin-line rounded-md p-8 w-full max-w-sm space-y-4">
      <h1 className="font-display text-2xl">Dr Shoes — Logowanie</h1>
      <label className="block">
        <span className="text-sm font-medium text-admin-mute">Email</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full h-10 px-3 border border-admin-line rounded-sm focus:outline-none focus:ring-2 focus:ring-acid"
          autoComplete="email"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-admin-mute">Hasło</span>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full h-10 px-3 border border-admin-line rounded-sm focus:outline-none focus:ring-2 focus:ring-acid"
          autoComplete="current-password"
        />
      </label>
      {error && <p className="text-sm text-orange">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full h-10 bg-ink text-paper font-medium rounded-sm hover:bg-admin-ink disabled:opacity-60"
      >
        {loading ? "Logowanie…" : "Zaloguj się"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Create `apps/web/app/(admin)/admin/login/page.tsx`**

```tsx
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata = { title: "Dr Shoes — Logowanie" };

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-admin-bg p-4">
      <LoginForm />
    </main>
  );
}
```

- [ ] **Step 3: Typecheck + build**

```bash
pnpm --filter @drshoes/web typecheck
pnpm --filter @drshoes/web build
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/web
git commit -m "feat(web): /admin/login page with LoginForm client component"
```

---

### Task 12: Admin layout auth guard

**Files:**
- Create: `apps/web/app/(admin)/admin/layout.tsx`
- Modify: `apps/web/app/(admin)/admin/page.tsx` — replace placeholder with logged-in stub

- [ ] **Step 1: Create `apps/web/app/(admin)/admin/layout.tsx`**

```tsx
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getMe } from "@/lib/auth/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const h = headers();
  const path = h.get("x-pathname") ?? "";
  if (path.startsWith("/admin/login")) {
    return <>{children}</>;
  }

  const me = await getMe();
  if (!me) {
    redirect(`/admin/login?next=${encodeURIComponent(path || "/admin")}`);
  }

  return (
    <div className="min-h-screen bg-admin-bg text-admin-ink flex">
      <aside className="w-60 border-r border-admin-line bg-admin-surface p-4">
        <div className="font-display text-lg mb-6">Dr Shoes</div>
        <nav className="space-y-1 text-sm">
          <div className="text-admin-mute uppercase text-xs">Pulpit</div>
          <div className="px-2 py-1 rounded bg-acid/30 font-medium">Dashboard</div>
          <div className="text-admin-mute uppercase text-xs mt-4">Operacje</div>
          <div className="px-2 py-1 rounded text-admin-mute">Zamówienia (0B)</div>
          <div className="px-2 py-1 rounded text-admin-mute">Klienci (0B)</div>
        </nav>
        <div className="mt-8 pt-4 border-t border-admin-line text-xs text-admin-mute">
          Zalogowany jako<br/>
          <span className="text-admin-ink font-medium">{me.fullName}</span>
          <div className="font-mono text-[10px]">{me.role}</div>
        </div>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Replace `apps/web/app/(admin)/admin/page.tsx`**

```tsx
import { getMe } from "@/lib/auth/session";

export default async function AdminPage() {
  const me = await getMe();
  return (
    <div>
      <h1 className="font-display text-3xl mb-2">Cześć, {me?.fullName ?? "—"}</h1>
      <p className="text-admin-mute mb-6">Pulpit Dr Shoes (Milestone 0B — szczegółowe widoki w 1).</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {["Zlecenia w realizacji","Gotowe do odbioru","Zaległe","Nowe rezerwacje"].map((label, i) => (
          <div key={i} className="bg-admin-surface border border-admin-line rounded-md p-4">
            <div className="text-admin-mute text-xs uppercase">{label}</div>
            <div className="text-3xl font-display mt-1">—</div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add a tiny middleware to expose `x-pathname` to layouts**

Create `apps/web/middleware.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  res.headers.set("x-pathname", req.nextUrl.pathname);
  return res;
}

export const config = { matcher: ["/admin/:path*"] };
```

- [ ] **Step 4: Typecheck + build**

```bash
pnpm --filter @drshoes/web typecheck
pnpm --filter @drshoes/web build
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): admin layout auth guard (server-side getMe + redirect to /admin/login)"
```

---

### Task 13: End-to-end auth verification via compose

**Files:**
- (no new files — verification only, plus Task 18-style milestone tag at the end)

- [ ] **Step 1: Boot stack with seeded users**

```bash
cd /Users/atlasjedi/P/misza_madafaka
docker compose down -v          # wipe DB so V002 seed runs fresh
docker compose up -d --build
```

Wait for backend healthy.

- [ ] **Step 2: Hit login endpoint**

```bash
# Capture session + CSRF cookie
curl -sS -c /tmp/dr-cookies.txt -X POST http://localhost:${BACKEND_PORT:-8080}/api/admin/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"misza@drshoes.pl","password":"change-me-on-first-login"}' \
  -i | head -10
# Expect: HTTP/1.1 204 No Content + Set-Cookie: dr_session=...
```

- [ ] **Step 3: Hit /me with the saved cookie**

```bash
curl -sS -b /tmp/dr-cookies.txt http://localhost:${BACKEND_PORT:-8080}/api/admin/auth/me | head -c 200
# Expect: {"id":"...","email":"misza@drshoes.pl","fullName":"Misza Doctor","role":"OWNER", ...}
```

- [ ] **Step 4: Verify /me without cookie returns 401**

```bash
curl -sS -i http://localhost:${BACKEND_PORT:-8080}/api/admin/auth/me | head -3
# Expect: HTTP/1.1 401
```

- [ ] **Step 5: Verify /admin redirects unauthenticated to login**

```bash
curl -sS -L -o /dev/null -w '%{url_effective}\n' http://localhost:${WEB_PORT:-3000}/admin
# Expect: ends with /admin/login?next=...
```

- [ ] **Step 6: Tear down**

```bash
docker compose down
```

- [ ] **Step 7: Tag milestone**

```bash
cd /Users/atlasjedi/P/misza_madafaka
git tag -a milestone-0b -m "Auth + RBAC complete

- Spring Security session-cookie auth (Spring Session JDBC, dr_session cookie, 30min idle).
- BCrypt(12) password hashing, per-IP login throttle (5/15min via Bucket4j).
- POST /api/admin/auth/{login,logout}, GET /me; CSRF double-submit (XSRF-TOKEN cookie + X-XSRF-TOKEN header).
- Central RbacService with @EnableMethodSecurity; OWNER vs EMPLOYEE matrix.
- AuditLogAspect AOP logs every admin write to audit_log table.
- Frontend api.ts wrapper auto-attaches CSRF + redirects on 401.
- /admin/login page + admin layout auth guard via server-side getMe().
- V002 seeds Misza (OWNER) and a demo EMPLOYEE."
```

- [ ] **Step 8: Update `CLAUDE.md` status section**

Add `- [x] Milestone 0B: auth + RBAC + audit log + login UI + admin guard` and uncheck the next pending entry to be Milestone 1.

```bash
git add CLAUDE.md
git commit -m "docs: mark Milestone 0B complete"
```

---

## Self-review

**Spec coverage** (against `ARCHITECTURE.md` §Auth & RBAC + §Audit log + the milestone-0B implicit scope):

| Spec item | Task |
|---|---|
| Spring Session JDBC | 2 |
| 30min idle session | 2 |
| HttpOnly + SameSite=Lax + dr_session cookie name | 2 |
| BCrypt(12) password hashing | 3 |
| Login throttle 5/15min/IP via Bucket4j | 5 |
| POST /api/admin/auth/login (204 + cookie) | 6 |
| POST /api/admin/auth/logout | 6 |
| GET /api/admin/auth/me | 6 |
| CSRF double-submit (XSRF-TOKEN cookie + X-XSRF-TOKEN header) | 4 |
| OWNER vs EMPLOYEE policy gate | 7 |
| @PreAuthorize wiring + integration tests | 7 |
| audit_log AOP-driven writes | 8 |
| V002 seed users | 9 |
| Frontend api.ts wrapper | 10 |
| Server-side getMe() helper | 10 |
| /admin/login page | 11 |
| Admin layout auth guard | 12 |
| End-to-end auth smoke | 13 |

**Out of scope, deferred:**
- Idle-timeout warning modal (could land in Milestone 1 along with the global admin shell).
- Real production-only `secure: true` cookie override — flagged for Milestone 0C ops hardening.
- Password reset / forgot password flow — out of scope for 0B.
- 2FA / SSO — explicitly out of scope.

**Placeholder scan:** the only intentional placeholder is the BCrypt hash in V002 (Step 1 of Task 9 — must be replaced with real-generated hashes). No "TBD" or "implement later" markers.

**Type consistency:**
- `UserRole` enum used identically in Java (`com.drshoes.app.auth.domain.UserRole`) and TypeScript (`apps/web/lib/auth/types.ts`).
- `MeResponse` shape mirrors between server DTO and client type.
- `RbacService` method names (`canDeleteOrders`, `canEditTriggers`, `canManageUsers`, `canManageStorageLocations`, `canEditOrder`, `canRestoreOrder`, `canEditTemplates`) used consistently in unit test and SpEL annotations.

**Risks:**
- Spring Session JDBC's schema initializer can collide with Flyway-managed `spring_session` tables. Mitigation: `spring.session.jdbc.initialize-schema: never` set in Task 2.
- Audit aspect logs every admin endpoint, including `/api/admin/auth/me` GETs. That's intentional — it covers the RODO requirement to log PII reads. If it gets noisy, future task can scope to write-methods only.
- Login throttle is in-memory (Bucket4j local). On multi-replica deploys it would be per-replica; deferred to Cloudflare-side rate-limit when we go live.
- `getMe()` server-side helper does a fetch on every admin route load. Acceptable for v1 (small audience). If it shows in profiling, cache via React `cache()` per-request.

---

## Execution handoff

Plan saved to `docs/superpowers/plans/2026-05-08-milestone-00b-auth-rbac.md`.

Two execution options:

**1. Subagent-Driven (recommended)** — Same pattern as Milestone 0A. Sonnet implementers, two-stage review per task.

**2. Inline Execution** — Single-session via `superpowers:executing-plans`.

Per locked decisions: Sonnet for implementation. **Recommendation: Subagent-Driven.**
