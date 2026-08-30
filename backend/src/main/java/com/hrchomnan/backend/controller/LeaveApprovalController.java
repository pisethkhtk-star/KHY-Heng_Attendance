package com.hrchomnan.backend.controller;

import com.hrchomnan.backend.enums.Role;
import com.hrchomnan.backend.model.Department;
import com.hrchomnan.backend.model.Employee;
import com.hrchomnan.backend.model.LeaveApprovalRule;
import com.hrchomnan.backend.repository.DepartmentRepository;
import com.hrchomnan.backend.repository.EmployeeRepository;
import com.hrchomnan.backend.repository.LeaveApprovalRuleRepository;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/leave-approvals")
@Transactional
@RequiredArgsConstructor
@PreAuthorize("@perm.has('leave_approvals') or hasAnyRole('Admin', 'HR')")
@Slf4j
public class LeaveApprovalController {

    private final LeaveApprovalRuleRepository ruleRepository;
    private final EmployeeRepository employeeRepository;
    private final DepartmentRepository departmentRepository;
    private final com.hrchomnan.backend.repository.PositionRepository positionRepository;
    private final com.hrchomnan.backend.repository.EmployeeFaceDataRepository employeeFaceDataRepository;

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getAllRules(
            @RequestParam(required = false) String approverId,
            @RequestParam(required = false) String ruleType
    ) {
        List<LeaveApprovalRule> rules = ruleRepository.findAll();
        if (approverId != null && !approverId.isBlank()) {
            final String aId = approverId.trim();
            rules = rules.stream().filter(r -> aId.equalsIgnoreCase(r.getApproverId())).collect(Collectors.toList());
        }

        if (ruleType != null && !ruleType.isBlank()) {
            final String rt = ruleType.trim().toUpperCase();
            rules = rules.stream().filter(r -> {
                String currentRt = r.getRuleType() != null ? r.getRuleType().toUpperCase() : "LEAVE";
                return rt.equals(currentRt);
            }).collect(Collectors.toList());
        }

        rules.sort(Comparator.comparing(LeaveApprovalRule::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())));

        Map<String, Employee> empMap = employeeRepository.findAll().stream()
                .collect(Collectors.toMap(Employee::getStaffId, e -> e, (a, b) -> a));
        Map<UUID, Department> deptMap = departmentRepository.findAll().stream()
                .collect(Collectors.toMap(Department::getId, d -> d, (a, b) -> a));
        Map<UUID, com.hrchomnan.backend.model.Position> posMap = positionRepository.findAll().stream()
                .collect(Collectors.toMap(com.hrchomnan.backend.model.Position::getId, p -> p, (a, b) -> a));
        Map<String, String> faceDataMap = employeeFaceDataRepository.findAll().stream()
                .filter(f -> f.getStaffId() != null && f.getPhotoUrl() != null)
                .collect(Collectors.toMap(com.hrchomnan.backend.model.EmployeeFaceData::getStaffId, com.hrchomnan.backend.model.EmployeeFaceData::getPhotoUrl, (a, b) -> a));

        List<Map<String, Object>> response = rules.stream().map(rule -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", rule.getId());
            map.put("approverId", rule.getApproverId());
            map.put("scope", rule.getScope());
            map.put("targetDeptId", rule.getTargetDeptId());
            map.put("targetStaffId", rule.getTargetStaffId());
            map.put("ruleType", rule.getRuleType() != null ? rule.getRuleType() : "LEAVE");
            map.put("createdAt", rule.getCreatedAt());
            map.put("updatedAt", rule.getUpdatedAt());

            Employee approver = empMap.get(rule.getApproverId());
            if (approver != null) {
                String photo = (approver.getPhotoUrl() != null && !approver.getPhotoUrl().isBlank())
                        ? approver.getPhotoUrl()
                        : faceDataMap.get(approver.getStaffId());
                Map<String, Object> aMap = new HashMap<>();
                aMap.put("nameEn", approver.getNameEn());
                aMap.put("nameKh", approver.getNameKh());
                aMap.put("staffId", approver.getStaffId());
                aMap.put("photoUrl", photo);
                aMap.put("role", approver.getRole() != null ? approver.getRole().name() : null);
                aMap.put("email", approver.getEmail());
                if (approver.getDepartmentId() != null && deptMap.containsKey(approver.getDepartmentId())) {
                    Department d = deptMap.get(approver.getDepartmentId());
                    aMap.put("department", Map.of("nameEn", d.getNameEn(), "nameKh", d.getNameKh()));
                }
                if (approver.getPositionId() != null && posMap.containsKey(approver.getPositionId())) {
                    com.hrchomnan.backend.model.Position p = posMap.get(approver.getPositionId());
                    aMap.put("position", Map.of("titleEn", p.getTitleEn(), "titleKh", p.getTitleKh()));
                }
                map.put("approver", aMap);
            } else {
                map.put("approver", null);
            }

            if ("Department".equalsIgnoreCase(rule.getScope()) && rule.getTargetDeptId() != null) {
                Department dept = deptMap.get(rule.getTargetDeptId());
                if (dept != null) {
                    map.put("targetDept", Map.of("nameEn", dept.getNameEn(), "nameKh", dept.getNameKh()));
                } else {
                    map.put("targetDept", null);
                }
            } else {
                map.put("targetDept", null);
            }

            if ("Employee".equalsIgnoreCase(rule.getScope()) && rule.getTargetStaffId() != null) {
                Employee targetEmp = empMap.get(rule.getTargetStaffId());
                if (targetEmp != null) {
                    String photo = (targetEmp.getPhotoUrl() != null && !targetEmp.getPhotoUrl().isBlank())
                            ? targetEmp.getPhotoUrl()
                            : faceDataMap.get(targetEmp.getStaffId());
                    Map<String, Object> tMap = new HashMap<>();
                    tMap.put("nameEn", targetEmp.getNameEn());
                    tMap.put("nameKh", targetEmp.getNameKh());
                    tMap.put("staffId", targetEmp.getStaffId());
                    tMap.put("photoUrl", photo);
                    tMap.put("role", targetEmp.getRole() != null ? targetEmp.getRole().name() : null);
                    tMap.put("email", targetEmp.getEmail());
                    if (targetEmp.getDepartmentId() != null && deptMap.containsKey(targetEmp.getDepartmentId())) {
                        Department d = deptMap.get(targetEmp.getDepartmentId());
                        tMap.put("department", Map.of("nameEn", d.getNameEn(), "nameKh", d.getNameKh()));
                    }
                    if (targetEmp.getPositionId() != null && posMap.containsKey(targetEmp.getPositionId())) {
                        com.hrchomnan.backend.model.Position p = posMap.get(targetEmp.getPositionId());
                        tMap.put("position", Map.of("titleEn", p.getTitleEn(), "titleKh", p.getTitleKh()));
                    }
                    map.put("targetEmployee", tMap);
                } else {
                    map.put("targetEmployee", null);
                }
            } else {
                map.put("targetEmployee", null);
            }

            return map;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(response);
    }

    @Data
    public static class CreateRuleRequest {
        private String approverId;
        private String scope; // "Department" or "Employee"
        private UUID targetDeptId;
        private String targetStaffId;
        private List<String> targetStaffIds;
        private String ruleType; // "LEAVE" or "OVERTIME"
    }

    @PostMapping
    public ResponseEntity<?> createRule(@RequestBody CreateRuleRequest request) {
        if (request.getApproverId() == null || request.getScope() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Approver and Scope are required"));
        }

        final String ruleType = (request.getRuleType() != null && !request.getRuleType().isBlank())
                ? request.getRuleType().trim().toUpperCase()
                : "LEAVE";

        Optional<Employee> approverOpt = employeeRepository.findByStaffId(request.getApproverId());
        if (approverOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Approver employee not found"));
        }

        if (!"CHECKIN".equalsIgnoreCase(ruleType) && approverOpt.get().getRole() == Role.Employee) {
            return ResponseEntity.badRequest().body(Map.of("message", "Normal employees cannot be approvers for leave or overtime"));
        }

        if ("Department".equalsIgnoreCase(request.getScope())) {
            if (request.getTargetDeptId() == null) {
                return ResponseEntity.badRequest().body(Map.of("message", "Department is required for Department scope"));
            }

            boolean exists = ruleRepository.findAll().stream().anyMatch(r ->
                    request.getApproverId().equalsIgnoreCase(r.getApproverId()) &&
                            "Department".equalsIgnoreCase(r.getScope()) &&
                            request.getTargetDeptId().equals(r.getTargetDeptId()) &&
                            ruleType.equalsIgnoreCase(r.getRuleType() != null ? r.getRuleType() : "LEAVE")
            );

            if (exists) {
                return ResponseEntity.badRequest().body(Map.of("message", "This " + ruleType.toLowerCase() + " approval rule already exists for this department"));
            }

            LeaveApprovalRule rule = LeaveApprovalRule.builder()
                    .approverId(request.getApproverId())
                    .scope("Department")
                    .targetDeptId(request.getTargetDeptId())
                    .ruleType(ruleType)
                    .build();

            LeaveApprovalRule saved = ruleRepository.save(rule);
            return ResponseEntity.status(HttpStatus.CREATED).body(saved);
        } else {
            List<String> staffIds = request.getTargetStaffIds() != null && !request.getTargetStaffIds().isEmpty()
                    ? request.getTargetStaffIds()
                    : (request.getTargetStaffId() != null ? List.of(request.getTargetStaffId()) : Collections.emptyList());

            if (staffIds.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("message", "At least one target employee is required"));
            }

            List<LeaveApprovalRule> createdRules = new ArrayList<>();
            List<String> skippedIds = new ArrayList<>();

            for (String tId : staffIds) {
                // An employee can only have ONE approver rule per ruleType (Leave / Overtime)
                boolean alreadyHasApprover = ruleRepository.findAll().stream().anyMatch(r ->
                        "Employee".equalsIgnoreCase(r.getScope()) &&
                                tId.equalsIgnoreCase(r.getTargetStaffId()) &&
                                ruleType.equalsIgnoreCase(r.getRuleType() != null ? r.getRuleType() : "LEAVE")
                );

                if (alreadyHasApprover) {
                    skippedIds.add(tId);
                    continue;
                }

                LeaveApprovalRule rule = LeaveApprovalRule.builder()
                        .approverId(request.getApproverId())
                        .scope("Employee")
                        .targetStaffId(tId)
                        .ruleType(ruleType)
                        .build();

                createdRules.add(ruleRepository.save(rule));
            }

            if (createdRules.isEmpty() && !skippedIds.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of(
                        "message", "Selected employee(s) already have a " + ruleType.toLowerCase() + " approver assigned. (បុគ្គលិកម្នាក់មានអ្នកអនុម័ត " + ruleType + " តែម្នាក់ប៉ុណ្ណោះ)"
                ));
            }

            return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                    "message", "Successfully created " + ruleType.toLowerCase() + " rules for " + createdRules.size() + " employees.",
                    "createdCount", createdRules.size(),
                    "skippedCount", skippedIds.size(),
                    "data", createdRules.isEmpty() ? null : createdRules.get(0)
            ));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateRule(@PathVariable UUID id, @RequestBody CreateRuleRequest request) {
        if (request.getApproverId() == null || request.getScope() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Approver and Scope are required"));
        }

        Optional<Employee> approverOpt = employeeRepository.findByStaffId(request.getApproverId());
        if (approverOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Approver employee not found"));
        }

        Optional<LeaveApprovalRule> ruleOpt = ruleRepository.findById(id);
        if (ruleOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Approval rule not found"));
        }

        LeaveApprovalRule rule = ruleOpt.get();
        final String ruleType = (request.getRuleType() != null && !request.getRuleType().isBlank())
                ? request.getRuleType().trim().toUpperCase()
                : (rule.getRuleType() != null ? rule.getRuleType() : "LEAVE");

        if (!"CHECKIN".equalsIgnoreCase(ruleType) && approverOpt.get().getRole() == Role.Employee) {
            return ResponseEntity.badRequest().body(Map.of("message", "Normal employees cannot be approvers for leave or overtime"));
        }

        if ("Department".equalsIgnoreCase(request.getScope())) {
            if (request.getTargetDeptId() == null) {
                return ResponseEntity.badRequest().body(Map.of("message", "Department is required for Department scope"));
            }

            boolean exists = ruleRepository.findAll().stream().anyMatch(r ->
                    !id.equals(r.getId()) &&
                            request.getApproverId().equalsIgnoreCase(r.getApproverId()) &&
                            "Department".equalsIgnoreCase(r.getScope()) &&
                            request.getTargetDeptId().equals(r.getTargetDeptId()) &&
                            ruleType.equalsIgnoreCase(r.getRuleType() != null ? r.getRuleType() : "LEAVE")
            );

            if (exists) {
                return ResponseEntity.badRequest().body(Map.of("message", "This " + ruleType.toLowerCase() + " approval rule already exists for this department"));
            }

            rule.setApproverId(request.getApproverId());
            rule.setScope("Department");
            rule.setTargetDeptId(request.getTargetDeptId());
            rule.setTargetStaffId(null);
            rule.setRuleType(ruleType);

            return ResponseEntity.ok(ruleRepository.save(rule));
        } else {
            if (request.getTargetStaffId() == null && (request.getTargetStaffIds() == null || request.getTargetStaffIds().isEmpty())) {
                return ResponseEntity.badRequest().body(Map.of("message", "Target employee is required"));
            }

            String targetStaffId = request.getTargetStaffId() != null
                    ? request.getTargetStaffId()
                    : request.getTargetStaffIds().get(0);

            boolean alreadyHasApprover = ruleRepository.findAll().stream().anyMatch(r ->
                    !id.equals(r.getId()) &&
                            "Employee".equalsIgnoreCase(r.getScope()) &&
                            targetStaffId.equalsIgnoreCase(r.getTargetStaffId()) &&
                            ruleType.equalsIgnoreCase(r.getRuleType() != null ? r.getRuleType() : "LEAVE")
            );

            if (alreadyHasApprover) {
                return ResponseEntity.badRequest().body(Map.of(
                        "message", "This employee already has a " + ruleType.toLowerCase() + " approver assigned. (បុគ្គលិកម្នាក់មានអ្នកអនុម័ត " + ruleType + " តែម្នាក់ប៉ុណ្ណោះ)"
                ));
            }

            rule.setApproverId(request.getApproverId());
            rule.setScope("Employee");
            rule.setTargetStaffId(targetStaffId);
            rule.setTargetDeptId(null);
            rule.setRuleType(ruleType);

            return ResponseEntity.ok(ruleRepository.save(rule));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteRule(@PathVariable UUID id) {
        if (ruleRepository.existsById(id)) {
            ruleRepository.deleteById(id);
            return ResponseEntity.ok(Map.of("message", "Approval rule deleted successfully"));
        }
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Approval rule not found"));
    }
}
