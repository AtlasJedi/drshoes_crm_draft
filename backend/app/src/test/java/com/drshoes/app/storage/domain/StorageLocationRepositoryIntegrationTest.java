package com.drshoes.app.storage.domain;

import com.drshoes.app.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@Transactional
class StorageLocationRepositoryIntegrationTest extends AbstractIntegrationTest {

    @Autowired StorageLocationRepository repo;

    @Test
    void findAllActive_returns_active_only_sorted_by_position_then_name() {
        var a = save("półka 1", 1, true);
        var b = save("suszarka", 0, true);
        save("stary kąt", 99, false);

        List<StorageLocation> active = repo.findAllActive();

        assertThat(active).extracting(StorageLocation::getName)
            .containsExactly("suszarka", "półka 1");
    }

    @Test
    void findAllIncludingInactive_returns_all_active_first_then_inactive() {
        save("a-active", 1, true);
        save("z-inactive", 0, false);

        List<StorageLocation> all = repo.findAllIncludingInactive();

        assertThat(all).extracting(StorageLocation::getName)
            .containsExactly("a-active", "z-inactive");
    }

    @Test
    void existsByNameAndActiveTrue_true_when_active_match() {
        save("półka 1", 0, true);
        assertThat(repo.existsByNameAndActiveTrue("półka 1")).isTrue();
    }

    @Test
    void existsByNameAndActiveTrue_false_when_inactive_match() {
        save("półka 1", 0, false);
        assertThat(repo.existsByNameAndActiveTrue("półka 1")).isFalse();
    }

    @Test
    void existsByNameAndActiveTrue_false_when_no_match() {
        assertThat(repo.existsByNameAndActiveTrue("brak")).isFalse();
    }

    private StorageLocation save(String name, int position, boolean active) {
        var l = new StorageLocation();
        l.setName(name);
        l.setPosition(position);
        l.setActive(active);
        return repo.save(l);
    }
}
