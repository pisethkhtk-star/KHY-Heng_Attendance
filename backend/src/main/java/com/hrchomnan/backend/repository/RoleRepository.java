package com.hrchomnan.backend.repository;

import com.hrchomnan.backend.model.RoleEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface RoleRepository extends JpaRepository<RoleEntity, Long> {
    Optional<RoleEntity> findByNameIgnoreCase(String name);
    Optional<RoleEntity> findByName(String name);
    boolean existsByNameIgnoreCase(String name);
}
