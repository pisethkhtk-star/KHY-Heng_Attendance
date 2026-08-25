package com.hrchomnan.backend.controller;

import com.hrchomnan.backend.enums.Role;
import com.hrchomnan.backend.model.RolePermission;
import com.hrchomnan.backend.repository.RolePermissionRepository;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/permissions")
@RequiredArgsConstructor
public class PermissionController {

    private final RolePermissionRepository rolePermissionRepository;

    @GetMapping
    public ResponseEntity<List<RolePermission>> getAllPermissions(@RequestParam(required = false) String role) {
        if (role != null && !role.isBlank()) {
            try {
                Role roleEnum = Role.valueOf(role);
                return ResponseEntity.ok(rolePermissionRepository.findByRole(roleEnum));
            } catch (IllegalArgumentException ignored) {}
        }
        return ResponseEntity.ok(rolePermissionRepository.findAll());
    }

    @Data
    public static class BatchPermissionsRequest {
        private List<RolePermission> permissions;
    }

    @PutMapping
    public ResponseEntity<?> updatePermissions(@RequestBody Object payload) {
        if (payload instanceof Map<?, ?> map && map.containsKey("permissions")) {
            Object permsObj = map.get("permissions");
            if (permsObj instanceof List<?> list) {
                for (Object item : list) {
                    if (item instanceof Map<?, ?> pMap) {
                        try {
                            String roleStr = (String) pMap.get("role");
                            String resource = (String) pMap.get("resource");
                            Boolean canAccess = (Boolean) pMap.get("canAccess");

                            if (roleStr != null && resource != null && canAccess != null) {
                                Role role = Role.valueOf(roleStr);
                                Optional<RolePermission> existing = rolePermissionRepository.findByRoleAndResource(role, resource);
                                if (existing.isPresent()) {
                                    RolePermission perm = existing.get();
                                    perm.setCanAccess(canAccess);
                                    rolePermissionRepository.save(perm);
                                } else {
                                    rolePermissionRepository.save(RolePermission.builder()
                                            .role(role)
                                            .resource(resource)
                                            .canAccess(canAccess)
                                            .build());
                                }
                            }
                        } catch (Exception ignored) {}
                    }
                }
                return ResponseEntity.ok(Map.of("message", "Permissions updated successfully"));
            }
        }

        return ResponseEntity.ok(Map.of("message", "Permissions updated successfully"));
    }
}
