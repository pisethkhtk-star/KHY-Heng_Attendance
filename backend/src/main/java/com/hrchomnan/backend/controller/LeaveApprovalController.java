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
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/leave-approvals")
@RequiredArgsConstructor
@Slf4j
public class LeaveApprovalController {

    private final LeaveApprovalRuleRepository ruleRepository;
    private final EmployeeRepository employeeRepository;
    private final DepartmentRepository departmentRepository;

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getAllRules(@RequestParam(required = false) String approverId) {
        List<LeaveApprovalRule> rules = ruleRepository.findAll();
        if (approverId != null && !approverId.isBlank()) {
            final String aId = approverId.trim();
            rules = rules.stream().filter(r -> aId.equalsIgnoreCase(r.getApproverId())).collect(Collectors.toList());
        }

        rules.sort(Comparator.comparing(LeaveApprovalRule::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())));

        Map<String, Employee> empMap = employeeRepository.findAll().stream()
                .collect(Collectors.toMap(Employee::getStaffId, e -> e, (a, b) -> a));
        Map<UUID, Department> deptMap = departmentRepository.findAll().stream()
                .collect(Collectors.toMap(Department::getId, d -> d, (a, b) -> a));

        List<Map<String, Object>> response = rules.stream().map(rule -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", rule.getId());
            map.put("approverId", rule.getApproverId());
            map.put("scope", rule.getScope());
            map.put("targetDeptId", rule.getTargetDeptId());
            map.put("targetStaffId", rule.getTargetStaffId());
            map.put("createdAt", rule.getCreatedAt());
            map.put("updatedAt", rule.getUpdatedAt());

            Employee approver = empMap.get(rule.getApproverId());
            if (approver != null) {
                map.put("approver", Map.of(
                        "nameEn", approver.getNameEn(),
                        "nameKh", approver.getNameKh(),
                        "staffId", approver.getStaffId()
                ));
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
                    map.put("targetEmployee", Map.of(
                            "nameEn", targetEmp.getNameEn(),
                            "nameKh", targetEmp.getNameKh(),
                            "staffId", targetEmp.getStaffId()
                    ));
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
    }

    @PostMapping
    public ResponseEntity<?> createRule(@RequestBody CreateRuleRequest request) {
        if (request.getApproverId() == null || request.getScope() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Approver and Scope are required"));
        }

        Optional<Employee> approverOpt = employeeRepository.findByStaffId(request.getApproverId());
        if (approverOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Approver employee not found"));
        }

        if (approverOpt.get().getRole() == Role.Employee) {
            return ResponseEntity.badRequest().body(Map.of("message", "Normal employees cannot be leave approvers"));
        }

        if ("Department".equalsIgnoreCase(request.getScope())) {
            if (request.getTargetDeptId() == null) {
                return ResponseEntity.badRequest().body(Map.of("message", "Department is required for Department scope"));
            }

            boolean exists = ruleRepository.findAll().stream().anyMatch(r ->
                    request.getApproverId().equalsIgnoreCase(r.getApproverId()) &&
                            "Department".equalsIgnoreCase(r.getScope()) &&
                            request.getTargetDeptId().equals(r.getTargetDeptId())
            );

            if (exists) {
                return ResponseEntity.badRequest().body(Map.of("message", "This approval rule already exists for this department"));
            }

            LeaveApprovalRule rule = LeaveApprovalRule.builder()
                    .approverId(request.getApproverId())
                    .scope("Department")
                    .targetDeptId(request.getTargetDeptId())
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
                boolean exists = ruleRepository.findAll().stream().anyMatch(r ->
                        request.getApproverId().equalsIgnoreCase(r.getApproverId()) &&
                                "Employee".equalsIgnoreCase(r.getScope()) &&
                                tId.equalsIgnoreCase(r.getTargetStaffId())
                );

                if (exists) {
                    skippedIds.add(tId);
                    continue;
                }

                LeaveApprovalRule rule = LeaveApprovalRule.builder()
                        .approverId(request.getApproverId())
                        .scope("Employee")
                        .targetStaffId(tId)
                        .build();

                createdRules.add(ruleRepository.save(rule));
            }

            if (createdRules.isEmpty() && !skippedIds.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("message", "All selected employees already have this approval rule set."));
            }

            return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                    "message", "Successfully created rules for " + createdRules.size() + " employees.",
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

        if (approverOpt.get().getRole() == Role.Employee) {
            return ResponseEntity.badRequest().body(Map.of("message", "Normal employees cannot be leave approvers"));
        }

        Optional<LeaveApprovalRule> ruleOpt = ruleRepository.findById(id);
        if (ruleOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Approval rule not found"));
        }

        LeaveApprovalRule rule = ruleOpt.get();

        if ("Department".equalsIgnoreCase(request.getScope())) {
            if (request.getTargetDeptId() == null) {
                return ResponseEntity.badRequest().body(Map.of("message", "Department is required for Department scope"));
            }

            boolean exists = ruleRepository.findAll().stream().anyMatch(r ->
                    !id.equals(r.getId()) &&
                            request.getApproverId().equalsIgnoreCase(r.getApproverId()) &&
                            "Department".equalsIgnoreCase(r.getScope()) &&
                            request.getTargetDeptId().equals(r.getTargetDeptId())
            );

            if (exists) {
                return ResponseEntity.badRequest().body(Map.of("message", "This approval rule already exists for this department"));
            }

            rule.setApproverId(request.getApproverId());
            rule.setScope("Department");
            rule.setTargetDeptId(request.getTargetDeptId());
            rule.setTargetStaffId(null);

            return ResponseEntity.ok(ruleRepository.save(rule));
        } else {
            if (request.getTargetStaffId() == null && (request.getTargetStaffIds() == null || request.getTargetStaffIds().isEmpty())) {
                return ResponseEntity.badRequest().body(Map.of("message", "Target employee is required"));
            }

            String targetStaffId = request.getTargetStaffId() != null
                    ? request.getTargetStaffId()
                    : request.getTargetStaffIds().get(0);

            boolean exists = ruleRepository.findAll().stream().anyMatch(r ->
                    !id.equals(r.getId()) &&
                            request.getApproverId().equalsIgnoreCase(r.getApproverId()) &&
                            "Employee".equalsIgnoreCase(r.getScope()) &&
                            targetStaffId.equalsIgnoreCase(r.getTargetStaffId())
            );

            if (exists) {
                return ResponseEntity.badRequest().body(Map.of("message", "This approval rule already exists for this employee"));
            }

            rule.setApproverId(request.getApproverId());
            rule.setScope("Employee");
            rule.setTargetStaffId(targetStaffId);
            rule.setTargetDeptId(null);

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
