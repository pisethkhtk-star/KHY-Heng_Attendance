package com.hrchomnan.backend.security;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hrchomnan.backend.enums.Role;
import com.hrchomnan.backend.model.Employee;
import com.hrchomnan.backend.model.RolePermission;
import com.hrchomnan.backend.model.LeaveApprovalRule;
import com.hrchomnan.backend.repository.EmployeeRepository;
import com.hrchomnan.backend.repository.LeaveApprovalRuleRepository;
import com.hrchomnan.backend.repository.RolePermissionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Component("perm")
@RequiredArgsConstructor
public class SecurityPermissionService {

    private final RolePermissionRepository rolePermissionRepository;
    private final EmployeeRepository employeeRepository;
    private final LeaveApprovalRuleRepository leaveApprovalRuleRepository;
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

    /**
     * Checks if the authenticated user is authorized to check in on behalf of targetStaffId
     */
    public boolean canCheckinOnBehalf(String targetStaffId) {
        if (targetStaffId == null || targetStaffId.isBlank()) return false;
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) return false;
        if (!(auth.getPrincipal() instanceof Employee currentEmp)) return false;

        String currentStaffId = currentEmp.getStaffId();
        if (currentStaffId == null) return false;

        if (currentStaffId.equalsIgnoreCase(targetStaffId)) return true;

        List<LeaveApprovalRule> rules = leaveApprovalRuleRepository.findByRuleType("CHECKIN");
        if (rules.isEmpty()) return false;

        Optional<Employee> targetOpt = employeeRepository.findByStaffId(targetStaffId);

        return rules.stream().anyMatch(r -> {
            if (!currentStaffId.equalsIgnoreCase(r.getApproverId())) return false;
            if ("Employee".equalsIgnoreCase(r.getScope())) {
                return targetStaffId.equalsIgnoreCase(r.getTargetStaffId());
            }
            if ("Department".equalsIgnoreCase(r.getScope()) && r.getTargetDeptId() != null && targetOpt.isPresent()) {
                return r.getTargetDeptId().equals(targetOpt.get().getDepartmentId());
            }
            return false;
        });
    }

    /**
     * Checks if current user can view QR code for targetStaffId:
     * - Admin can view QR of ALL roles.
     * - Other roles CANNOT view Admin's QR.
     * - HR can view QR of self, Manager, Employee.
     * - Manager can view QR of Employee and self.
     * - Employee can view QR of self only.
     */
    public boolean canViewQr(String targetStaffId) {
        if (targetStaffId == null || targetStaffId.isBlank()) return false;
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) return false;
        if (!(auth.getPrincipal() instanceof Employee currentEmp)) return false;

        Optional<Employee> freshCurr = employeeRepository.findById(currentEmp.getId());
        Employee curr = freshCurr.orElse(currentEmp);

        Optional<Employee> targetOpt = employeeRepository.findByStaffId(targetStaffId);
        if (targetOpt.isEmpty()) return false;
        Employee target = targetOpt.get();

        Role currRole = curr.getRole();
        Role targetRole = target.getRole();
        boolean isSelf = curr.getStaffId() != null && curr.getStaffId().equalsIgnoreCase(target.getStaffId());

        if (currRole == Role.Admin) return true;
        if (targetRole == Role.Admin && !isSelf) return false;

        if (currRole == Role.HR) {
            return isSelf || targetRole == Role.Manager || targetRole == Role.Employee;
        }

        if (currRole == Role.Manager) {
            return isSelf || targetRole == Role.Employee;
        }

        return isSelf;
    }

    /**
     * Checks if current user can edit target employee:
     * - Self can edit own profile
     * - Admin can edit anyone
     * - HR can edit self, Manager, Employee
     * - Manager can edit self only
     */
    public boolean canEditEmployee(UUID targetId) {
        if (targetId == null) return false;
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) return false;
        if (!(auth.getPrincipal() instanceof Employee currentEmp)) return false;

        Optional<Employee> freshCurr = employeeRepository.findById(currentEmp.getId());
        Employee curr = freshCurr.orElse(currentEmp);

        Optional<Employee> targetOpt = employeeRepository.findById(targetId);
        if (targetOpt.isEmpty()) return false;
        Employee target = targetOpt.get();

        Role currRole = curr.getRole();
        Role targetRole = target.getRole();
        boolean isSelf = curr.getId().equals(target.getId());

        if (isSelf) return true;
        if (currRole == Role.Admin) return true;
        if (currRole == Role.HR) {
            return targetRole == Role.Manager || targetRole == Role.Employee;
        }
        return false;
    }

    /**
     * Checks if current user can edit password of target employee:
     * - Admin can edit password of all roles
     * - Other roles cannot edit Admin's password
     * - HR can edit password of self, Manager, Employee
     * - Manager can edit password of self only
     */
    public boolean canEditPassword(UUID targetId) {
        if (targetId == null) return false;
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) return false;
        if (!(auth.getPrincipal() instanceof Employee currentEmp)) return false;

        Optional<Employee> freshCurr = employeeRepository.findById(currentEmp.getId());
        Employee curr = freshCurr.orElse(currentEmp);

        Optional<Employee> targetOpt = employeeRepository.findById(targetId);
        if (targetOpt.isEmpty()) return false;
        Employee target = targetOpt.get();

        Role currRole = curr.getRole();
        Role targetRole = target.getRole();
        boolean isSelf = curr.getId().equals(target.getId());

        if (currRole == Role.Admin) return true;
        if (targetRole == Role.Admin && !isSelf) return false;

        if (currRole == Role.HR) {
            return isSelf || targetRole == Role.Manager || targetRole == Role.Employee;
        }

        if (currRole == Role.Manager) {
            return isSelf;
        }

        return isSelf;
    }
}
