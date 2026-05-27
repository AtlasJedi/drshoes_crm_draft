package com.drshoes.app.auth.api;

import com.drshoes.app.auth.api.dto.UserStubDto;
import com.drshoes.app.auth.domain.UserRepository;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import lombok.extern.slf4j.Slf4j;
import lombok.RequiredArgsConstructor;
@RestController
@RequestMapping("/api/admin/users")
@Slf4j
@RequiredArgsConstructor
public class UsersController {

    private final UserRepository users;

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
