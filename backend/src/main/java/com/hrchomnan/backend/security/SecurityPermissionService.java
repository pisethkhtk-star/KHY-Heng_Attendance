package com.hrchomnan.backend.security;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hrchomnan.backend.enums.Role;
import com.hrchomnan.backend.model.Employee;
import com.hrchomnan.backend.model.RolePermission;
import com.hrchomnan.backend.repository.EmployeeRepository;
import com.hrchomnan.backend.repository.RolePermissionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.List;
import java.util.Optional;

@Slf4j
@Component("perm")
@RequiredArgsConstructor
public class SecurityPermissionService {

    private final RolePermissionRepository rolePermissionRepository;
    private final EmployeeRepository employeeRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Checks if current authenticated user has access to specified resource.
     * 1. Admin always has full access (true).
     * 2. If employee has customPermissions configured, evaluates customized list.
     * 3. Otherwise, falls back to role_permissions repository for employee's base role.
     */
    public boolean has(String resource) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            return false;
        }

        Object principal = auth.getPrincipal();
        if (!(principal instanceof Employee empPrincipal)) {
            return false;
        }

        // Re-fetch fresh employee state if possible to guarantee up-to-date permissions
        Optional<Employee> freshOpt = employeeRepository.findById(empPrincipal.getId());
        Employee employee = freshOpt.orElse(empPrincipal);

        // 1. Admin role always has unrestricted access
        if (employee.getRole() == Role.Admin) {
            return true;
        }

        // 2. Check individual custom permissions if defined
        String custom = employee.getCustomPermissions();
        if (custom != null && !custom.isBlank() && !custom.equals("[]")) {
            try {
                List<String> customList = objectMapper.readValue(custom, new TypeReference<List<String>>() {});
                return customList.contains(resource);
            } catch (Exception e) {
                log.warn("Failed to parse custom permissions for employee {}: {}", employee.getStaffId(), e.getMessage());
            }
        }

        // 3. Fallback to Role Permissions from DB
        Optional<RolePermission> rpOpt = rolePermissionRepository.findByRoleAndResource(employee.getRole(), resource);
        return rpOpt.isPresent() && Boolean.TRUE.equals(rpOpt.get().getCanAccess());
    }

    /**
     * Checks if the authenticated user is either Admin OR matching the target staffId
     */
    public boolean isSelfOrAdmin(String staffId) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            return false;
        }

        if (!(auth.getPrincipal() instanceof Employee employee)) {
            return false;
        }

        if (employee.getRole() == Role.Admin) {
            return true;
        }

        return employee.getStaffId() != null && employee.getStaffId().equalsIgnoreCase(staffId);
    }
}
