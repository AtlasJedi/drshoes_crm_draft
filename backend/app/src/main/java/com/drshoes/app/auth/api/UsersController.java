package com.drshoes.app.auth.api;

import com.drshoes.app.auth.api.dto.UserStubDto;
import com.drshoes.app.auth.domain.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * REST controller exposing the active-user list for the assignee dropdown.
 *
 * Endpoint:
 *   GET /api/admin/users — 200 + List<UserStubDto>, auth enforced by SecurityConfig
 *
 * Structured logging per dispatch-protocol §7:
 *   op=listUsers  actor={}  count={}  outcome=ok
 */
@RestController
@RequestMapping("/api/admin/users")
public class UsersController {

    private static final Logger log = LoggerFactory.getLogger(UsersController.class);

    private final UserRepository users;

    public UsersController(UserRepository users) {
        this.users = users;
    }

    @GetMapping
    public List<UserStubDto> listUsers(Authentication auth) {
        List<UserStubDto> result = users.findAllByActiveTrueOrderByFullName()
            .stream()
            .map(UserStubDto::of)
            .toList();
        log.info("op=listUsers actor={} count={} outcome=ok", auth.getName(), result.size());
        return result;
    }
}
