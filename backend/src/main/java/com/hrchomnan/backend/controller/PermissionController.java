package com.hrchomnan.backend.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hrchomnan.backend.enums.Role;
import com.hrchomnan.backend.model.Employee;
import com.hrchomnan.backend.model.RolePermission;
import com.hrchomnan.backend.repository.EmployeeRepository;
import com.hrchomnan.backend.repository.RolePermissionRepository;
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
@RequestMapping("/permissions")
@Transactional
@RequiredArgsConstructor
@PreAuthorize("@perm.has('permissions')")
public class PermissionController {

    private final RolePermissionRepository rolePermissionRepository;
    private final EmployeeRepository employeeRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

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

    /**
     * Get individual employee permission details
     */
    @GetMapping("/employee/{id}")
    public ResponseEntity<?> getEmployeePermissions(@PathVariable UUID id) {
        Optional<Employee> empOpt = employeeRepository.findById(id);
        if (empOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Employee not found"));
        }

        Employee emp = empOpt.get();
        List<RolePermission> rolePerms = rolePermissionRepository.findByRole(emp.getRole());
        List<String> roleAllowedResources = rolePerms.stream()
                .filter(p -> Boolean.TRUE.equals(p.getCanAccess()))
                .map(RolePermission::getResource)
                .collect(Collectors.toList());

        boolean hasCustom = emp.getCustomPermissions() != null && !emp.getCustomPermissions().isBlank();
        List<String> effectiveResources;

        if (hasCustom) {
            try {
                effectiveResources = objectMapper.readValue(emp.getCustomPermissions(), new TypeReference<List<String>>() {});
            } catch (Exception e) {
                effectiveResources = Arrays.stream(emp.getCustomPermissions().split(","))
                        .map(String::trim)
                        .filter(s -> !s.isEmpty())
                        .collect(Collectors.toList());
            }
        } else {
            effectiveResources = roleAllowedResources;
        }

        Map<String, Object> response = new HashMap<>();
        response.put("employeeId", emp.getId());
        response.put("staffId", emp.getStaffId());
        response.put("nameEn", emp.getNameEn());
        response.put("nameKh", emp.getNameKh());
        response.put("role", emp.getRole());
        response.put("hasCustom", hasCustom);
        response.put("customPermissions", hasCustom ? effectiveResources : null);
        response.put("rolePermissions", roleAllowedResources);
        response.put("effectivePermissions", effectiveResources);
        response.put("canLoginWeb", emp.getRole() == Role.Admin || Boolean.TRUE.equals(emp.getCanLoginWeb()));

        return ResponseEntity.ok(response);
    }

    @Data
    public static class UpdateEmployeePermissionsRequest {
        private List<String> customPermissions;
        private Boolean resetToRole;
        private Boolean canLoginWeb;
    }

    /**
     * Update or reset individual employee permissions
     */
    @PutMapping("/employee/{id}")
    public ResponseEntity<?> updateEmployeePermissions(
            @PathVariable UUID id,
            @RequestBody UpdateEmployeePermissionsRequest request
    ) {
        Optional<Employee> empOpt = employeeRepository.findById(id);
        if (empOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Employee not found"));
        }

        Employee emp = empOpt.get();

        if (Boolean.TRUE.equals(request.getResetToRole())) {
            emp.setCustomPermissions(null);
        } else if (request.getCustomPermissions() != null) {
            try {
                String json = objectMapper.writeValueAsString(request.getCustomPermissions());
                emp.setCustomPermissions(json);
            } catch (Exception e) {
                emp.setCustomPermissions(String.join(",", request.getCustomPermissions()));
            }
        }

        if (request.getCanLoginWeb() != null && emp.getRole() != Role.Admin) {
            emp.setCanLoginWeb(request.getCanLoginWeb());
        }

        employeeRepository.save(emp);

        return ResponseEntity.ok(Map.of(
                "message", "Employee permissions updated successfully",
                "hasCustom", emp.getCustomPermissions() != null,
                "canLoginWeb", emp.getRole() == Role.Admin || Boolean.TRUE.equals(emp.getCanLoginWeb())
        ));
    }

    /**
     * Quick toggle for Web Login permission
     */
    @PutMapping("/employee/{id}/toggle-web-login")
    public ResponseEntity<?> toggleWebLogin(
            @PathVariable UUID id,
            @RequestBody Map<String, Boolean> body
    ) {
        Optional<Employee> empOpt = employeeRepository.findById(id);
        if (empOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Employee not found"));
        }

        Employee emp = empOpt.get();
        if (emp.getRole() == Role.Admin) {
            return ResponseEntity.ok(Map.of(
                    "message", "Admin always has web login access",
                    "canLoginWeb", true
            ));
        }

        Boolean canLogin = body.get("canLoginWeb");
        emp.setCanLoginWeb(Boolean.TRUE.equals(canLogin));
        employeeRepository.save(emp);

        return ResponseEntity.ok(Map.of(
                "message", "Web login permission updated",
                "canLoginWeb", Boolean.TRUE.equals(emp.getCanLoginWeb())
        ));
    }
}
