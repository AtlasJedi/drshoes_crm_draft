package com.drshoes.app.client.domain;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface ClientRepository extends JpaRepository<Client, UUID> {

    Page<Client> findAllByDeletedAtIsNull(Pageable pageable);

    @Query("""
        SELECT c FROM Client c
        WHERE c.deletedAt IS NULL
          AND (LOWER(c.firstName) LIKE LOWER(CONCAT('%', :q, '%'))
            OR LOWER(c.lastName)  LIKE LOWER(CONCAT('%', :q, '%'))
            OR c.phone LIKE CONCAT('%', :q, '%')
            OR LOWER(c.email) LIKE LOWER(CONCAT('%', :q, '%')))
        ORDER BY c.lastName, c.firstName
        """)
    List<Client> searchTopN(String q, Pageable pageable);
}
