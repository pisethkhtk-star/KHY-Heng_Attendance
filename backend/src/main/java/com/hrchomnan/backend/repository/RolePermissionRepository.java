package com.hrchomnan.backend.repository;

import com.hrchomnan.backend.enums.Role;
import com.hrchomnan.backend.model.RolePermission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface RolePermissionRepository extends JpaRepository<RolePermission, UUID> {
    List<RolePermission> findByRole(Role role);
    Optional<RolePermission> findByRoleAndResource(Role role, String resource);
}
