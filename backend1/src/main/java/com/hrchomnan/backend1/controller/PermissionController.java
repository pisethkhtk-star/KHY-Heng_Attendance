package com.hrchomnan.backend1.controller;

import com.hrchomnan.backend1.enums.Role;
import com.hrchomnan.backend1.model.RolePermission;
import com.hrchomnan.backend1.repository.RolePermissionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/permissions")
@RequiredArgsConstructor
public class PermissionController {

    private final RolePermissionRepository rolePermissionRepository;

    @GetMapping
    public ResponseEntity<List<RolePermission>> getAllPermissions(@RequestParam(required = false) String role) {
        if (role != null) {
            try {
                Role roleEnum = Role.valueOf(role);
                return ResponseEntity.ok(rolePermissionRepository.findByRole(roleEnum));
            } catch (IllegalArgumentException ignored) {}
        }
        return ResponseEntity.ok(rolePermissionRepository.findAll());
    }

    @PutMapping
    public ResponseEntity<?> updatePermission(@RequestBody RolePermission permission) {
        return rolePermissionRepository.findByRoleAndResource(permission.getRole(), permission.getResource())
                .map(existing -> {
                    existing.setCanAccess(permission.getCanAccess());
                    return ResponseEntity.ok(rolePermissionRepository.save(existing));
                })
                .orElseGet(() -> ResponseEntity.ok(rolePermissionRepository.save(permission)));
    }
}
