package com.hrchomnan.backend.controller;

import com.hrchomnan.backend.model.RoleEntity;
import com.hrchomnan.backend.repository.EmployeeRepository;
import com.hrchomnan.backend.repository.RoleRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/roles")
@RequiredArgsConstructor
@Transactional
@Tag(name = "Roles", description = "Role management and database table access")
public class RoleController {

    private final RoleRepository roleRepository;
    private final EmployeeRepository employeeRepository;

    @Operation(summary = "Get all roles", description = "Retrieve list of all roles from database table with employee counts")
    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<Map<String, Object>>> getAllRoles() {
        List<RoleEntity> allRoles = roleRepository.findAll();
        
        // Count employees per role
        Map<String, Long> roleCounts = employeeRepository.findAll().stream()
                .filter(e -> e.getRole() != null)
                .collect(Collectors.groupingBy(e -> e.getRole().name().toLowerCase(), Collectors.counting()));

        List<Map<String, Object>> response = allRoles.stream()
                .sorted(Comparator.comparing(r -> getRoleSortOrder(r.getName())))
                .map(r -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("id", r.getId());
                    map.put("name", r.getName());
                    map.put("nameKh", r.getNameKh() != null ? r.getNameKh() : r.getName());
                    map.put("description", r.getDescription() != null ? r.getDescription() : "");
                    map.put("employeeCount", roleCounts.getOrDefault(r.getName().toLowerCase(), 0L));
                    map.put("createdAt", r.getCreatedAt());
                    map.put("updatedAt", r.getUpdatedAt());
                    map.put("isSystemRole", isSystemRole(r.getName()));
                    return map;
                })
                .collect(Collectors.toList());

        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Get role by ID")
    @GetMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getRoleById(@PathVariable Long id) {
        Optional<RoleEntity> roleOpt = roleRepository.findById(id);
        if (roleOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Role not found"));
        }
        RoleEntity r = roleOpt.get();
        long count = employeeRepository.findAll().stream()
                .filter(e -> (e.getRoleId() != null && e.getRoleId().equals(r.getId()))
                        || (e.getRole() != null && e.getRole().name().equalsIgnoreCase(r.getName())))
                .count();

        Map<String, Object> map = new HashMap<>();
        map.put("id", r.getId());
        map.put("name", r.getName());
        map.put("nameKh", r.getNameKh());
        map.put("description", r.getDescription());
        map.put("employeeCount", count);
        map.put("isSystemRole", isSystemRole(r.getName()));
        map.put("createdAt", r.getCreatedAt());
        map.put("updatedAt", r.getUpdatedAt());
        return ResponseEntity.ok(map);
    }

    @Operation(summary = "Get all employees belonging to a specific role")
    @GetMapping("/{id}/employees")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getEmployeesByRoleId(@PathVariable Long id) {
        Optional<RoleEntity> roleOpt = roleRepository.findById(id);
        if (roleOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Role not found"));
        }
        RoleEntity r = roleOpt.get();
        List<com.hrchomnan.backend.model.Employee> list = employeeRepository.findByRoleId(r.getId());
        List<Map<String, Object>> response = list.stream().map(e -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", e.getId());
            map.put("staffId", e.getStaffId());
            map.put("nameEn", e.getNameEn());
            map.put("nameKh", e.getNameKh());
            map.put("gender", e.getGender());
            map.put("branch", e.getBranch());
            map.put("email", e.getEmail());
            map.put("status", e.getStatus());
            map.put("photoUrl", e.getPhotoUrl());
            map.put("role", e.getRole());
            map.put("roleId", e.getRoleId());
            return map;
        }).collect(Collectors.toList());
        return ResponseEntity.ok(response);
    }

    @Data
    public static class RoleCreateDto {
        private String name;
        private String nameKh;
        private String description;
    }

    @Operation(summary = "Create role in roles table")
    @PostMapping
    @PreAuthorize("@perm.has('permissions')")
    public ResponseEntity<?> createRole(@RequestBody RoleCreateDto dto) {
        if (dto.getName() == null || dto.getName().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Role name is required"));
        }

        String name = dto.getName().trim();
        if (roleRepository.existsByNameIgnoreCase(name)) {
            return ResponseEntity.badRequest().body(Map.of("message", "Role with this name already exists"));
        }

        RoleEntity newRole = RoleEntity.builder()
                .name(name)
                .nameKh(dto.getNameKh() != null ? dto.getNameKh().trim() : name)
                .description(dto.getDescription() != null ? dto.getDescription().trim() : "")
                .build();

        RoleEntity saved = roleRepository.save(newRole);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @Operation(summary = "Update role")
    @PutMapping("/{id}")
    @PreAuthorize("@perm.has('permissions')")
    public ResponseEntity<?> updateRole(@PathVariable Long id, @RequestBody RoleCreateDto dto) {
        Optional<RoleEntity> roleOpt = roleRepository.findById(id);
        if (roleOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Role not found"));
        }

        RoleEntity role = roleOpt.get();
        if (dto.getNameKh() != null) {
            role.setNameKh(dto.getNameKh().trim());
        }
        if (dto.getDescription() != null) {
            role.setDescription(dto.getDescription().trim());
        }
        // System roles cannot have their english key name changed to preserve enum compatibility
        if (!isSystemRole(role.getName()) && dto.getName() != null && !dto.getName().isBlank()) {
            String newName = dto.getName().trim();
            if (!newName.equalsIgnoreCase(role.getName()) && roleRepository.existsByNameIgnoreCase(newName)) {
                return ResponseEntity.badRequest().body(Map.of("message", "Role with this name already exists"));
            }
            role.setName(newName);
        }

        RoleEntity updated = roleRepository.save(role);
        return ResponseEntity.ok(updated);
    }

    @Operation(summary = "Delete custom role")
    @DeleteMapping("/{id}")
    @PreAuthorize("@perm.has('permissions')")
    public ResponseEntity<?> deleteRole(@PathVariable Long id) {
        Optional<RoleEntity> roleOpt = roleRepository.findById(id);
        if (roleOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Role not found"));
        }

        RoleEntity role = roleOpt.get();
        if (isSystemRole(role.getName())) {
            return ResponseEntity.badRequest().body(Map.of("message", "Cannot delete core system role: " + role.getName()));
        }

        boolean hasEmployees = employeeRepository.findAll().stream()
                .anyMatch(e -> (e.getRoleId() != null && e.getRoleId().equals(role.getId()))
                        || (e.getRole() != null && e.getRole().name().equalsIgnoreCase(role.getName())));

        if (hasEmployees) {
            return ResponseEntity.badRequest().body(Map.of("message", "Cannot delete role because it is assigned to employees"));
        }

        roleRepository.delete(role);
        return ResponseEntity.ok(Map.of("message", "Role deleted successfully"));
    }

    private boolean isSystemRole(String name) {
        if (name == null) return false;
        String lower = name.trim().toLowerCase();
        return lower.equals("admin") || lower.equals("hr") || lower.equals("manager") || lower.equals("employee");
    }

    private int getRoleSortOrder(String name) {
        if (name == null) return 99;
        return switch (name.toLowerCase()) {
            case "admin" -> 1;
            case "hr" -> 2;
            case "manager" -> 3;
            case "employee" -> 4;
            default -> 10;
        };
    }
}
