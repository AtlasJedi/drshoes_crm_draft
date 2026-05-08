package com.drshoes.app.messaging.repository;

import com.drshoes.app.messaging.domain.TriggerEntity;
import com.drshoes.app.messaging.domain.TriggerEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface TriggerRepository extends JpaRepository<TriggerEntity, UUID> {
    List<TriggerEntity> findAllByEventAndEnabledTrue(TriggerEvent event);
    List<TriggerEntity> findAllByOrderByNameAsc();
}
