package com.hrchomnan.backend.repository;

import com.hrchomnan.backend.model.NssfConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface NssfConfigRepository extends JpaRepository<NssfConfig, UUID> {
    Optional<NssfConfig> findFirstByIsActiveTrueOrderByCreatedAtDesc();
}
