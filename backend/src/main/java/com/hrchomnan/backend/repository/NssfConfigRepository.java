package com.hrchomnan.backend.repository;

import com.hrchomnan.backend.model.NssfConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface NssfConfigRepository extends JpaRepository<NssfConfig, Long> {
    Optional<NssfConfig> findFirstByIsActiveTrueOrderByCreatedAtDesc();
}
