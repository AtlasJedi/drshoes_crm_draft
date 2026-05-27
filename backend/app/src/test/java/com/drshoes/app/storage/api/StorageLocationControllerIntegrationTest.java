package com.drshoes.app.storage.api;

import com.drshoes.app.AdminWebTestBase;
import com.drshoes.app.storage.domain.StorageLocation;
import com.drshoes.app.storage.domain.StorageLocationRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.hamcrest.Matchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class StorageLocationControllerIntegrationTest extends AdminWebTestBase {

    @Autowired StorageLocationRepository repo;

    @BeforeEach
    void loginAndCleanLocations() {
        repo.deleteAll();
        loginAsOwner();
    }

    @AfterEach
    void cleanupLocations() {
        repo.deleteAll();
    }

    @Test
    void GET_storage_locations_returns_only_active_by_default() throws Exception {
        save("aktywne", 0, true);
        save("nieaktywne", 0, false);

        mockMvc().perform(get("/api/admin/storage-locations"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].name").value("aktywne"))
            .andExpect(jsonPath("$[0].active").value(true));
    }

    @Test
    void GET_storage_locations_includeInactive_returns_all() throws Exception {
        save("a-active", 0, true);
        save("b-inactive", 0, false);

        mockMvc().perform(get("/api/admin/storage-locations?includeInactive=true"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(2));
    }

    @Test
    void POST_creates_location_returns_201() throws Exception {
        mockMvc().perform(post("/api/admin/storage-locations")
                .contentType("application/json")
                .content("{\"name\":\"półka 1\"}")
                .with(csrf()))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").exists())
            .andExpect(jsonPath("$.name").value("półka 1"))
            .andExpect(jsonPath("$.active").value(true));
    }

    @Test
    void POST_duplicate_name_returns_409() throws Exception {
        save("dup", 0, true);
        mockMvc().perform(post("/api/admin/storage-locations")
                .contentType("application/json")
                .content("{\"name\":\"dup\"}")
                .with(csrf()))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("LOCATION_CONFLICT"));
    }

    @Test
    void POST_blank_name_returns_400() throws Exception {
        mockMvc().perform(post("/api/admin/storage-locations")
                .contentType("application/json")
                .content("{\"name\":\"\"}")
                .with(csrf()))
            .andExpect(status().isBadRequest());
    }

    @Test
    void PATCH_updates_name_and_position() throws Exception {
        var l = save("orig", 0, true);
        mockMvc().perform(patch("/api/admin/storage-locations/" + l.getId())
                .contentType("application/json")
                .content("{\"name\":\"renamed\",\"position\":5}")
                .with(csrf()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("renamed"))
            .andExpect(jsonPath("$.position").value(5));
    }

    @Test
    void PATCH_rename_to_existing_returns_409() throws Exception {
        save("taken", 0, true);
        var l = save("other", 0, true);
        mockMvc().perform(patch("/api/admin/storage-locations/" + l.getId())
                .contentType("application/json")
                .content("{\"name\":\"taken\"}")
                .with(csrf()))
            .andExpect(status().isConflict());
    }

    @Test
    void PATCH_unknown_id_returns_404() throws Exception {
        mockMvc().perform(patch("/api/admin/storage-locations/99999")
                .contentType("application/json")
                .content("{\"name\":\"x\"}")
                .with(csrf()))
            .andExpect(status().isNotFound());
    }

    @Test
    void DELETE_soft_deletes_returns_204() throws Exception {
        var l = save("kandydat", 0, true);
        mockMvc().perform(delete("/api/admin/storage-locations/" + l.getId())
                .with(csrf()))
            .andExpect(status().isNoContent());
        StorageLocation reread = repo.findById(l.getId()).orElseThrow();
        org.assertj.core.api.Assertions.assertThat(reread.isActive()).isFalse();
    }

    private StorageLocation save(String name, int position, boolean active) {
        var l = new StorageLocation();
        l.setName(name);
        l.setPosition(position);
        l.setActive(active);
        return repo.save(l);
    }
}
