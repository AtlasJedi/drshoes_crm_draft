package com.drshoes.app.storage.service;

import com.drshoes.app.storage.domain.StorageLocation;
import com.drshoes.app.storage.domain.StorageLocationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import lombok.extern.slf4j.Slf4j;
import lombok.RequiredArgsConstructor;

/**
 * CRUD for the simple string-set of storage locations.
 *
 * Policy:
 *   - name UNIQUE — rename to existing → LocationConflictException (mapped 409 by controller).
 *   - Missing id on update/deactivate → LocationNotFoundException (mapped 404).
 *   - deactivate is soft-delete (active=false). Historical orders.location strings unaffected.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class StorageLocationService {

    private final StorageLocationRepository repo;

    public List<StorageLocation> listActive() {
        return repo.findAllActive();
    }

    public List<StorageLocation> listAll() {
        return repo.findAllIncludingInactive();
    }

    @Transactional
    public StorageLocation create(String name) {
        if (repo.findByName(name).isPresent()) {
            log.info("op=storageLocation.create name={} outcome=conflict", name);
            throw new LocationConflictException(name);
        }
        StorageLocation l = new StorageLocation();
        l.setName(name);
        l.setPosition(0);
        l.setActive(true);
        StorageLocation saved = repo.save(l);
        log.info("op=storageLocation.create name={} id={} outcome=ok", name, saved.getId());
        return saved;
    }

    @Transactional
    public StorageLocation update(Long id, String name, Integer position, Boolean active) {
        StorageLocation l = repo.findById(id)
            .orElseThrow(() -> new LocationNotFoundException(id));
        if (name != null && !name.equals(l.getName())) {
            if (repo.findByName(name).isPresent()) {
                throw new LocationConflictException(name);
            }
            l.setName(name);
        }
        if (position != null) l.setPosition(position);
        if (active != null) l.setActive(active);
        StorageLocation saved = repo.save(l);
        log.info("op=storageLocation.update id={} name={} position={} active={} outcome=ok",
            id, l.getName(), l.getPosition(), l.isActive());
        return saved;
    }

    @Transactional
    public void deactivate(Long id) {
        StorageLocation l = repo.findById(id)
            .orElseThrow(() -> new LocationNotFoundException(id));
        l.setActive(false);
        repo.save(l);
        log.info("op=storageLocation.deactivate id={} outcome=ok", id);
    }
}
