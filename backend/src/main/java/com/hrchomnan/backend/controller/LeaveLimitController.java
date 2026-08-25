package com.hrchomnan.backend.controller;

import com.hrchomnan.backend.enums.LeaveStatus;
import com.hrchomnan.backend.enums.Role;
import com.hrchomnan.backend.enums.Status;
import com.hrchomnan.backend.model.*;
import com.hrchomnan.backend.repository.*;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/employee-leave-limits")
@RequiredArgsConstructor
@Slf4j
public class LeaveLimitController {

    private final EmployeeLeaveLimitRepository leaveLimitRepository;
    private final EmployeeRepository employeeRepository;
    private final LeaveTypeRepository leaveTypeRepository;
    private final LeaveRepository leaveRepository;
    private final DepartmentRepository departmentRepository;
    private final PositionRepository positionRepository;

    @GetMapping
    public ResponseEntity<?> getEmployeeLeaveLimits(
            @RequestParam(required = false) String staffId,
            Authentication authentication
    ) {
        Employee currentUser = (authentication != null && authentication.getPrincipal() instanceof Employee emp) ? emp : null;
        String targetStaffId = staffId;
        if (currentUser != null && currentUser.getRole() == Role.Employee) {
            targetStaffId = currentUser.getStaffId();
        }

        try {
            // 1. Fetch active employees
            List<Employee> employees = employeeRepository.findAll().stream()
                    .filter(e -> e.getStatus() == Status.Active)
                    .sorted(Comparator.comparing(Employee::getStaffId, Comparator.nullsLast(String::compareToIgnoreCase)))
                    .collect(Collectors.toList());

            if (targetStaffId != null && !targetStaffId.isBlank()) {
                final String sId = targetStaffId.trim();
                employees = employees.stream()
                        .filter(e -> e.getStaffId().equalsIgnoreCase(sId))
                        .collect(Collectors.toList());
            }

            // 2. Fetch all leave types
            List<LeaveType> leaveTypes = leaveTypeRepository.findAll().stream()
                    .sorted(Comparator.comparing(LeaveType::getCode, Comparator.nullsLast(String::compareToIgnoreCase)))
                    .collect(Collectors.toList());

            // 3. Fetch all custom overrides
            List<EmployeeLeaveLimit> customLimits = leaveLimitRepository.findAll();

            // 4. Fetch approved/pending leaves for current year
            int currentYear = LocalDate.now().getYear();
            LocalDate startDate = LocalDate.of(currentYear, 1, 1);
            LocalDate endDate = LocalDate.of(currentYear, 12, 31);

            List<Leave> leaves = leaveRepository.findAll().stream()
                    .filter(l -> (l.getStatus() == LeaveStatus.Pending || l.getStatus() == LeaveStatus.Approved)
                            && l.getLeaveDate() != null
                            && !l.getLeaveDate().isBefore(startDate)
                            && !l.getLeaveDate().isAfter(endDate))
                    .collect(Collectors.toList());

            Map<UUID, Department> deptMap = departmentRepository.findAll().stream()
                    .collect(Collectors.toMap(Department::getId, d -> d, (a, b) -> a));
            Map<UUID, Position> posMap = positionRepository.findAll().stream()
                    .collect(Collectors.toMap(Position::getId, p -> p, (a, b) -> a));

            // 5. Aggregate balances in memory
            List<Map<String, Object>> reportData = employees.stream().map(emp -> {
                List<Map<String, Object>> allowances = leaveTypes.stream().map(type -> {
                    Optional<EmployeeLeaveLimit> customOpt = customLimits.stream()
                            .filter(c -> emp.getStaffId().equalsIgnoreCase(c.getStaffId()) && type.getCode().equalsIgnoreCase(c.getLeaveCode()))
                            .findFirst();

                    double maxDays = customOpt.map(EmployeeLeaveLimit::getMaxDays)
                            .orElse(type.getMaxDays() != null ? type.getMaxDays() : 18.0);

                    double usedDays = leaves.stream()
                            .filter(l -> emp.getStaffId().equalsIgnoreCase(l.getStaffId())
                                    && (type.getCode().equalsIgnoreCase(l.getLeaveType()) || type.getNameEn().equalsIgnoreCase(l.getLeaveType())))
                            .mapToDouble(l -> l.getAmountDays() != null ? l.getAmountDays().doubleValue() : 1.0)
                            .sum();

                    Map<String, Object> allowance = new HashMap<>();
                    allowance.put("id", type.getId());
                    allowance.put("code", type.getCode());
                    allowance.put("nameEn", type.getNameEn());
                    allowance.put("nameKh", type.getNameKh());
                    allowance.put("maxDays", maxDays);
                    allowance.put("usedDays", usedDays);
                    allowance.put("hasOverride", customOpt.isPresent());
                    return allowance;
                }).collect(Collectors.toList());

                Map<String, Object> empData = new HashMap<>();
                empData.put("staffId", emp.getStaffId());
                empData.put("nameEn", emp.getNameEn());
                empData.put("nameKh", emp.getNameKh());

                Department d = emp.getDepartmentId() != null ? deptMap.get(emp.getDepartmentId()) : null;
                if (d != null) {
                    empData.put("department", Map.of("nameEn", d.getNameEn(), "nameKh", d.getNameKh()));
                } else {
                    empData.put("department", null);
                }

                Position p = emp.getPositionId() != null ? posMap.get(emp.getPositionId()) : null;
                if (p != null) {
                    empData.put("position", Map.of("titleEn", p.getTitleEn(), "titleKh", p.getTitleKh()));
                } else {
                    empData.put("position", null);
                }

                empData.put("allowances", allowances);
                return empData;
            }).collect(Collectors.toList());

            return ResponseEntity.ok(reportData);
        } catch (Exception e) {
            log.error("Error loading employee leave limits:", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("message", "Server error loading employee leave limits"));
        }
    }

    @Data
    public static class UpsertLimitRequest {
        private String staffId;
        private String leaveCode;
        private Double maxDays;
    }

    @PostMapping
    public ResponseEntity<?> upsertEmployeeLeaveLimit(@RequestBody UpsertLimitRequest request) {
        if (request.getStaffId() == null || request.getLeaveCode() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "staffId and leaveCode are required"));
        }

        try {
            if (request.getMaxDays() == null) {
                // Reset to default -> delete override
                List<EmployeeLeaveLimit> existingList = leaveLimitRepository.findByStaffId(request.getStaffId()).stream()
                        .filter(lim -> request.getLeaveCode().equalsIgnoreCase(lim.getLeaveCode()))
                        .collect(Collectors.toList());
                for (EmployeeLeaveLimit ex : existingList) {
                    leaveLimitRepository.delete(ex);
                }
                return ResponseEntity.ok(Map.of("message", "Reset to default successfully"));
            }

            Optional<EmployeeLeaveLimit> existingOpt = leaveLimitRepository.findByStaffId(request.getStaffId()).stream()
                    .filter(lim -> request.getLeaveCode().equalsIgnoreCase(lim.getLeaveCode()))
                    .findFirst();

            EmployeeLeaveLimit limit;
            if (existingOpt.isPresent()) {
                limit = existingOpt.get();
                limit.setMaxDays(request.getMaxDays());
            } else {
                limit = EmployeeLeaveLimit.builder()
                        .staffId(request.getStaffId())
                        .leaveCode(request.getLeaveCode().trim().toUpperCase())
                        .maxDays(request.getMaxDays())
                        .build();
            }

            EmployeeLeaveLimit saved = leaveLimitRepository.save(limit);
            return ResponseEntity.ok(Map.of("message", "Custom limit updated successfully", "data", saved));
        } catch (Exception e) {
            log.error("Error saving employee custom limit:", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("message", "Server error saving custom limit"));
        }
    }

    @DeleteMapping("/{staffId}")
    public ResponseEntity<?> deleteEmployeeLeaveLimits(@PathVariable String staffId) {
        if (staffId == null || staffId.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "staffId is required"));
        }

        try {
            List<EmployeeLeaveLimit> existing = leaveLimitRepository.findByStaffId(staffId);
            int count = existing.size();
            leaveLimitRepository.deleteAll(existing);

            return ResponseEntity.ok(Map.of(
                    "message", "All custom leave limits for " + staffId + " have been reset to global defaults.",
                    "deletedCount", count
            ));
        } catch (Exception e) {
            log.error("Error deleting employee leave limits for staffId: {}", staffId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("message", "Server error deleting custom leave limits"));
        }
    }
}
