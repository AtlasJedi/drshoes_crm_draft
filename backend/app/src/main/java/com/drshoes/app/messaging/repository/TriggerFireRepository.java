package com.drshoes.app.messaging.repository;

import com.drshoes.app.messaging.domain.TriggerFireEntity;
import com.drshoes.app.messaging.domain.TriggerFireId;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TriggerFireRepository extends JpaRepository<TriggerFireEntity, TriggerFireId> {
}
