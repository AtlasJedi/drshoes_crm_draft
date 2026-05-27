package com.drshoes.app.auth.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

public interface UserRepository extends JpaRepository<User, UUID> {

    @Query("select u from User u where lower(u.email) = lower(?1)")
    Optional<User> findByEmailIgnoreCase(String email);

    @Query("select u from User u where lower(u.email) = lower(?1) and u.active = true")
    Optional<User> findActiveByEmailIgnoreCase(String email);

    List<User> findAllByActiveTrueOrderByFullName();
}
