package com.drshoes.app.storage.service;

import com.drshoes.app.storage.domain.StorageLocation;
import com.drshoes.app.storage.domain.StorageLocationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class StorageLocationServiceTest {

    StorageLocationRepository repo;
    StorageLocationService svc;

    @BeforeEach
    void setUp() {
        repo = mock(StorageLocationRepository.class);
        svc = new StorageLocationService(repo);
    }

    @Test
    void create_persists_new_location_with_default_position() {
        when(repo.findByName("półka 1")).thenReturn(Optional.empty());
        when(repo.save(any(StorageLocation.class))).thenAnswer(inv -> {
            StorageLocation arg = inv.getArgument(0);
            return arg;
        });

        StorageLocation created = svc.create("półka 1");

        ArgumentCaptor<StorageLocation> cap = ArgumentCaptor.forClass(StorageLocation.class);
        verify(repo).save(cap.capture());
        assertThat(cap.getValue().getName()).isEqualTo("półka 1");
        assertThat(cap.getValue().isActive()).isTrue();
    }

    @Test
    void create_throws_conflict_when_name_exists() {
        when(repo.findByName("dup")).thenReturn(Optional.of(new StorageLocation()));

        assertThatThrownBy(() -> svc.create("dup"))
            .isInstanceOf(LocationConflictException.class)
            .hasMessageContaining("dup");
    }

    @Test
    void update_changes_name_and_position() {
        StorageLocation existing = new StorageLocation();
        existing.setName("old");
        existing.setPosition(0);
        when(repo.findById(7L)).thenReturn(Optional.of(existing));
        when(repo.findByName("new")).thenReturn(Optional.empty());
        when(repo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        StorageLocation updated = svc.update(7L, "new", 5, true);

        assertThat(updated.getName()).isEqualTo("new");
        assertThat(updated.getPosition()).isEqualTo(5);
    }

    @Test
    void update_rename_to_existing_throws_conflict() {
        StorageLocation target = new StorageLocation();
        when(repo.findById(7L)).thenReturn(Optional.of(target));
        StorageLocation other = new StorageLocation();
        other.setName("taken");
        when(repo.findByName("taken")).thenReturn(Optional.of(other));

        assertThatThrownBy(() -> svc.update(7L, "taken", null, null))
            .isInstanceOf(LocationConflictException.class);
    }

    @Test
    void update_missing_id_throws_not_found() {
        when(repo.findById(99L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> svc.update(99L, "x", null, null))
            .isInstanceOf(LocationNotFoundException.class);
    }

    @Test
    void deactivate_sets_active_false() {
        StorageLocation existing = new StorageLocation();
        existing.setActive(true);
        when(repo.findById(7L)).thenReturn(Optional.of(existing));
        when(repo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        svc.deactivate(7L);

        assertThat(existing.isActive()).isFalse();
        verify(repo).save(existing);
    }

    @Test
    void list_active_delegates_to_repo() {
        when(repo.findAllActive()).thenReturn(List.of());
        svc.listActive();
        verify(repo).findAllActive();
    }

    @Test
    void list_all_delegates_to_repo() {
        when(repo.findAllIncludingInactive()).thenReturn(List.of());
        svc.listAll();
        verify(repo).findAllIncludingInactive();
    }
}
