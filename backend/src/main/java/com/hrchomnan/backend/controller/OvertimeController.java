package com.hrchomnan.backend.controller;

import com.hrchomnan.backend.enums.LeaveStatus;
import com.hrchomnan.backend.enums.Role;
import com.hrchomnan.backend.model.Department;
import com.hrchomnan.backend.model.Employee;
import com.hrchomnan.backend.model.KioskSetting;
import com.hrchomnan.backend.model.Overtime;
import com.hrchomnan.backend.model.Position;
import com.hrchomnan.backend.repository.DepartmentRepository;
import com.hrchomnan.backend.repository.EmployeeRepository;
import com.hrchomnan.backend.repository.KioskSettingRepository;
import com.hrchomnan.backend.repository.OvertimeRepository;
import com.hrchomnan.backend.repository.PositionRepository;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/overtimes")
@RequiredArgsConstructor
@Slf4j
public class OvertimeController {

    private final OvertimeRepository overtimeRepository;
    private final EmployeeRepository employeeRepository;
    private final DepartmentRepository departmentRepository;
    private final PositionRepository positionRepository;
    private final KioskSettingRepository kioskSettingRepository;
    private final com.hrchomnan.backend.repository.EmployeeFaceDataRepository employeeFaceDataRepository;
    private final com.hrchomnan.backend.repository.LeaveApprovalRuleRepository leaveApprovalRuleRepository;

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getAllOvertimes(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String departmentId,
            @RequestParam(required = false) String branch,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            Authentication authentication
    ) {
        Employee currentUser = (authentication != null && authentication.getPrincipal() instanceof Employee emp) ? emp : null;

        List<Overtime> list = overtimeRepository.findByOrderByRequestedAtDesc();

        // Role-based restrictions: Employees can only view their own overtime
        if (currentUser != null && currentUser.getRole() == Role.Employee) {
            final String myStaffId = currentUser.getStaffId();
            list = list.stream().filter(o -> myStaffId.equalsIgnoreCase(o.getStaffId())).collect(Collectors.toList());
        }

        if (status != null && !status.isBlank()) {
            try {
                LeaveStatus ls = LeaveStatus.valueOf(status);
                list = list.stream().filter(o -> o.getStatus() == ls).collect(Collectors.toList());
            } catch (IllegalArgumentException ignored) {}
        }

        if (branch != null && !branch.isBlank()) {
            final String branchLower = branch.trim().toLowerCase();
            list = list.stream().filter(o -> {
                boolean matchBranch = o.getBranch() != null && o.getBranch().toLowerCase().contains(branchLower);
                return matchBranch;
            }).collect(Collectors.toList());
        }

        if (startDate != null && !startDate.isBlank()) {
            LocalDate sDate = LocalDate.parse(startDate);
            list = list.stream().filter(o -> !o.getFromDate().isBefore(sDate)).collect(Collectors.toList());
        }

        if (endDate != null && !endDate.isBlank()) {
            LocalDate eDate = LocalDate.parse(endDate);
            list = list.stream().filter(o -> !o.getToDate().isAfter(eDate)).collect(Collectors.toList());
        }

        Map<String, Employee> employeeMap = employeeRepository.findAll().stream()
                .collect(Collectors.toMap(Employee::getStaffId, e -> e, (a, b) -> a));
        Map<UUID, Department> deptMap = departmentRepository.findAll().stream()
                .collect(Collectors.toMap(Department::getId, d -> d, (a, b) -> a));
        Map<UUID, Position> posMap = positionRepository.findAll().stream()
                .collect(Collectors.toMap(Position::getId, p -> p, (a, b) -> a));
        Map<UUID, KioskSetting> kioskMap = kioskSettingRepository.findAll().stream()
                .collect(Collectors.toMap(KioskSetting::getId, k -> k, (a, b) -> a));
        Map<String, String> faceDataMap = employeeFaceDataRepository.findAll().stream()
                .filter(f -> f.getStaffId() != null && f.getPhotoUrl() != null)
                .collect(Collectors.toMap(com.hrchomnan.backend.model.EmployeeFaceData::getStaffId, com.hrchomnan.backend.model.EmployeeFaceData::getPhotoUrl, (a, b) -> a));

        if (departmentId != null && !departmentId.isBlank()) {
            UUID deptUuid = UUID.fromString(departmentId);
            list = list.stream().filter(o -> {
                Employee emp = employeeMap.get(o.getStaffId());
                return emp != null && deptUuid.equals(emp.getDepartmentId());
            }).collect(Collectors.toList());
        }

        if (search != null && !search.isBlank()) {
            final String q = search.trim().toLowerCase();
            list = list.stream().filter(o -> {
                Employee emp = employeeMap.get(o.getStaffId());
                boolean sMatch = o.getStaffId() != null && o.getStaffId().toLowerCase().contains(q);
                boolean nEnMatch = emp != null && emp.getNameEn() != null && emp.getNameEn().toLowerCase().contains(q);
                boolean nKhMatch = emp != null && emp.getNameKh() != null && emp.getNameKh().toLowerCase().contains(q);
                return sMatch || nEnMatch || nKhMatch;
            }).collect(Collectors.toList());
        }

        List<Map<String, Object>> response = list.stream()
                .map(o -> enrichOvertime(o, employeeMap, deptMap, posMap, kioskMap, faceDataMap))
                .collect(Collectors.toList());

        return ResponseEntity.ok(response);
    }

    @GetMapping("/employee/{staffId}")
    public ResponseEntity<?> getByEmployee(
            @PathVariable String staffId,
            Authentication authentication
    ) {
        Employee currentUser = (authentication != null && authentication.getPrincipal() instanceof Employee emp) ? emp : null;
        if (currentUser != null && currentUser.getRole() == Role.Employee && !currentUser.getStaffId().equalsIgnoreCase(staffId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Unauthorized access to employee overtime history"));
        }

        List<Overtime> list = overtimeRepository.findByStaffIdOrderByRequestedAtDesc(staffId);
        Map<String, Employee> employeeMap = employeeRepository.findAll().stream()
                .collect(Collectors.toMap(Employee::getStaffId, e -> e, (a, b) -> a));
        Map<UUID, Department> deptMap = departmentRepository.findAll().stream()
                .collect(Collectors.toMap(Department::getId, d -> d, (a, b) -> a));
        Map<UUID, Position> posMap = positionRepository.findAll().stream()
                .collect(Collectors.toMap(Position::getId, p -> p, (a, b) -> a));
        Map<UUID, KioskSetting> kioskMap = kioskSettingRepository.findAll().stream()
                .collect(Collectors.toMap(KioskSetting::getId, k -> k, (a, b) -> a));

        List<Map<String, Object>> response = list.stream()
                .map(o -> enrichOvertime(o, employeeMap, deptMap, posMap, kioskMap))
                .collect(Collectors.toList());

        return ResponseEntity.ok(response);
    }

    @Data
    public static class CreateOvertimeRequest {
        private String staffId;
        private String fromDate;
        private String toDate;
        private String startTime;
        private String endTime;
        private Double amountDay;
        private String reason;
        private UUID branchId;
        private String branch;
    }

    @PostMapping
    public ResponseEntity<?> createOvertime(
            @RequestBody CreateOvertimeRequest request,
            Authentication authentication
    ) {
        Employee currentUser = (authentication != null && authentication.getPrincipal() instanceof Employee emp) ? emp : null;

        String resolvedStaffId = (currentUser != null && currentUser.getRole() == Role.Employee)
                ? currentUser.getStaffId()
                : (request.getStaffId() != null ? request.getStaffId() : (currentUser != null ? currentUser.getStaffId() : null));

        String resolvedFromDate = request.getFromDate();
        String resolvedToDate = request.getToDate() != null && !request.getToDate().isBlank() ? request.getToDate() : resolvedFromDate;

        if (resolvedStaffId == null || resolvedFromDate == null || request.getStartTime() == null || request.getEndTime() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Required fields are missing (staffId, fromDate, startTime, endTime)"));
        }

        Optional<Employee> empOpt = employeeRepository.findByStaffId(resolvedStaffId);
        if (empOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Employee not found"));
        }
        Employee employee = empOpt.get();

        LocalDate start = LocalDate.parse(resolvedFromDate);
        LocalDate end = LocalDate.parse(resolvedToDate);

        if (start.isAfter(end)) {
            return ResponseEntity.badRequest().body(Map.of("message", "From date must be before or equal to to date"));
        }

        String resolvedBranchName = request.getBranch() != null ? request.getBranch() : (employee.getBranch() != null ? employee.getBranch() : "");
        UUID resolvedBranchId = request.getBranchId();

        if (resolvedBranchId == null && !resolvedBranchName.isBlank()) {
            final String branchLower = resolvedBranchName.toLowerCase();
            Optional<KioskSetting> kiosk = kioskSettingRepository.findAll().stream()
                    .filter(k -> k.getName().toLowerCase().contains(branchLower))
                    .findFirst();
            if (kiosk.isPresent()) {
                resolvedBranchId = kiosk.get().getId();
            }
        } else if (resolvedBranchId != null && resolvedBranchName.isBlank()) {
            Optional<KioskSetting> kiosk = kioskSettingRepository.findById(resolvedBranchId);
            if (kiosk.isPresent()) {
                resolvedBranchName = kiosk.get().getName();
            }
        }

        BigDecimal resolvedAmountDay = request.getAmountDay() != null ? BigDecimal.valueOf(request.getAmountDay()) : BigDecimal.ZERO;
        if (resolvedAmountDay.compareTo(BigDecimal.ZERO) <= 0) {
            long days = Math.max(1, ChronoUnit.DAYS.between(start, end) + 1);
            try {
                String[] startParts = request.getStartTime().split(":");
                String[] endParts = request.getEndTime().split(":");
                double sH = Double.parseDouble(startParts[0]) + Double.parseDouble(startParts[1]) / 60.0;
                double eH = Double.parseDouble(endParts[0]) + Double.parseDouble(endParts[1]) / 60.0;
                double hours = eH - sH;
                if (hours < 0) hours += 24;
                double fraction = hours / 8.0;
                resolvedAmountDay = BigDecimal.valueOf(days * (fraction > 0 ? fraction : 1.0)).setScale(2, RoundingMode.HALF_UP);
            } catch (Exception e) {
                resolvedAmountDay = BigDecimal.valueOf(days);
            }
        }

        String creatorName = currentUser != null ? (currentUser.getNameEn() != null ? currentUser.getNameEn() : currentUser.getNameKh()) : "Employee";

        // Resolve designated approver from approval rules
        String assignedApproverId = null;
        String assignedApproverName = null;
        List<com.hrchomnan.backend.model.LeaveApprovalRule> indRules = leaveApprovalRuleRepository.findByTargetStaffId(resolvedStaffId).stream()
                .filter(r -> "Employee".equalsIgnoreCase(r.getScope()))
                .collect(Collectors.toList());
        if (!indRules.isEmpty()) {
            assignedApproverId = indRules.get(0).getApproverId();
        } else if (employee.getDepartmentId() != null) {
            List<com.hrchomnan.backend.model.LeaveApprovalRule> deptRules = leaveApprovalRuleRepository.findByTargetDeptId(employee.getDepartmentId()).stream()
                    .filter(r -> "Department".equalsIgnoreCase(r.getScope()))
                    .collect(Collectors.toList());
            if (!deptRules.isEmpty()) {
                assignedApproverId = deptRules.get(0).getApproverId();
            }
        }
        if (assignedApproverId != null) {
            Employee approverEmp = employeeRepository.findByStaffId(assignedApproverId).orElse(null);
            if (approverEmp != null) {
                assignedApproverName = approverEmp.getNameEn() != null ? approverEmp.getNameEn() : approverEmp.getNameKh();
            }
        }

        Overtime overtime = Overtime.builder()
                .staffId(resolvedStaffId)
                .fromDate(start)
                .toDate(end)
                .startTime(request.getStartTime())
                .endTime(request.getEndTime())
                .amountDay(resolvedAmountDay)
                .reason(request.getReason() != null ? request.getReason() : "")
                .branch(resolvedBranchName)
                .branchId(resolvedBranchId)
                .status(LeaveStatus.Pending)
                .managerId(assignedApproverId)
                .managerName(assignedApproverName)
                .createdBy(creatorName)
                .requestedAt(LocalDateTime.now())
                .build();

        Overtime saved = overtimeRepository.save(overtime);

        Map<String, Employee> employeeMap = employeeRepository.findAll().stream()
                .collect(Collectors.toMap(Employee::getStaffId, e -> e, (a, b) -> a));
        Map<UUID, Department> deptMap = departmentRepository.findAll().stream()
                .collect(Collectors.toMap(Department::getId, d -> d, (a, b) -> a));
        Map<UUID, Position> posMap = positionRepository.findAll().stream()
                .collect(Collectors.toMap(Position::getId, p -> p, (a, b) -> a));
        Map<UUID, KioskSetting> kioskMap = kioskSettingRepository.findAll().stream()
                .collect(Collectors.toMap(KioskSetting::getId, k -> k, (a, b) -> a));

        return ResponseEntity.status(HttpStatus.CREATED).body(enrichOvertime(saved, employeeMap, deptMap, posMap, kioskMap));
    }

    @Data
    public static class StatusUpdateRequest {
        private String status; // Approved, Rejected, Pending
        private String comment;
        private String managerName;
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<?> updateStatus(
            @PathVariable UUID id,
            @RequestBody StatusUpdateRequest request,
            Authentication authentication
    ) {
        if (request.getStatus() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Invalid status value. Must be Pending, Approved, or Rejected"));
        }

        LeaveStatus newStatus;
        try {
            newStatus = LeaveStatus.valueOf(request.getStatus().substring(0, 1).toUpperCase() + request.getStatus().substring(1).toLowerCase());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", "Invalid status value. Must be Pending, Approved, or Rejected"));
        }

        Optional<Overtime> existingOpt = overtimeRepository.findById(id);
        if (existingOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Overtime record not found"));
        }

        Overtime overtime = existingOpt.get();
        Employee currentUser = (authentication != null && authentication.getPrincipal() instanceof Employee emp) ? emp : null;

        // Approver validation (Admins can bypass)
        if (currentUser != null && currentUser.getRole() != Role.Admin) {
            Employee targetEmp = employeeRepository.findByStaffId(overtime.getStaffId()).orElse(null);
            List<com.hrchomnan.backend.model.LeaveApprovalRule> indRules = leaveApprovalRuleRepository.findByTargetStaffId(overtime.getStaffId()).stream()
                    .filter(r -> "Employee".equalsIgnoreCase(r.getScope()))
                    .collect(Collectors.toList());

            List<com.hrchomnan.backend.model.LeaveApprovalRule> deptRules = (targetEmp != null && targetEmp.getDepartmentId() != null)
                    ? leaveApprovalRuleRepository.findByTargetDeptId(targetEmp.getDepartmentId()).stream()
                    .filter(r -> "Department".equalsIgnoreCase(r.getScope()))
                    .collect(Collectors.toList())
                    : Collections.emptyList();

            Set<String> allowedApprovers = new HashSet<>();
            indRules.forEach(r -> allowedApprovers.add(r.getApproverId().toLowerCase()));
            deptRules.forEach(r -> allowedApprovers.add(r.getApproverId().toLowerCase()));

            if (!allowedApprovers.isEmpty() && !allowedApprovers.contains(currentUser.getStaffId().toLowerCase())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                        "message", "អ្នកមិនមានសិទ្ធិអនុម័ត Overtime របស់បុគ្គលិកនេះទេ! (You are not the designated approver for this employee)"
                ));
            }
        }

        String reviewerStaffId = currentUser != null ? currentUser.getStaffId() : "SYS_ADMIN";
        String reviewerName = request.getManagerName() != null ? request.getManagerName() : (currentUser != null ? (currentUser.getNameEn() != null ? currentUser.getNameEn() : currentUser.getNameKh()) : reviewerStaffId);

        overtime.setStatus(newStatus);
        if (request.getComment() != null) {
            overtime.setComment(request.getComment());
        }
        overtime.setManagerId(reviewerStaffId);
        overtime.setManagerName(reviewerName);
        overtime.setApprovedAt(newStatus != LeaveStatus.Pending ? LocalDateTime.now() : null);

        Overtime updated = overtimeRepository.save(overtime);

        Map<String, Employee> employeeMap = employeeRepository.findAll().stream()
                .collect(Collectors.toMap(Employee::getStaffId, e -> e, (a, b) -> a));
        Map<UUID, Department> deptMap = departmentRepository.findAll().stream()
                .collect(Collectors.toMap(Department::getId, d -> d, (a, b) -> a));
        Map<UUID, Position> posMap = positionRepository.findAll().stream()
                .collect(Collectors.toMap(Position::getId, p -> p, (a, b) -> a));
        Map<UUID, KioskSetting> kioskMap = kioskSettingRepository.findAll().stream()
                .collect(Collectors.toMap(KioskSetting::getId, k -> k, (a, b) -> a));

        return ResponseEntity.ok(enrichOvertime(updated, employeeMap, deptMap, posMap, kioskMap));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteOvertime(
            @PathVariable UUID id,
            Authentication authentication
    ) {
        Optional<Overtime> existingOpt = overtimeRepository.findById(id);
        if (existingOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Overtime request not found"));
        }

        Overtime overtime = existingOpt.get();
        Employee currentUser = (authentication != null && authentication.getPrincipal() instanceof Employee emp) ? emp : null;

        if (currentUser != null && currentUser.getRole() == Role.Employee) {
            if (!overtime.getStaffId().equalsIgnoreCase(currentUser.getStaffId())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Unauthorized to delete this overtime request"));
            }
            if (overtime.getStatus() != LeaveStatus.Pending) {
                return ResponseEntity.badRequest().body(Map.of("message", "Cannot delete overtime that has already been approved or rejected"));
            }
        }

        overtimeRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Overtime request deleted successfully"));
    }

    private Map<String, Object> enrichOvertime(
            Overtime o,
            Map<String, Employee> employeeMap,
            Map<UUID, Department> deptMap,
            Map<UUID, Position> posMap,
            Map<UUID, KioskSetting> kioskMap
    ) {
        Map<String, String> faceDataMap = employeeFaceDataRepository.findAll().stream()
                .filter(f -> f.getStaffId() != null && f.getPhotoUrl() != null)
                .collect(Collectors.toMap(com.hrchomnan.backend.model.EmployeeFaceData::getStaffId, com.hrchomnan.backend.model.EmployeeFaceData::getPhotoUrl, (a, b) -> a));
        return enrichOvertime(o, employeeMap, deptMap, posMap, kioskMap, faceDataMap);
    }

    private Map<String, Object> enrichOvertime(
            Overtime o,
            Map<String, Employee> employeeMap,
            Map<UUID, Department> deptMap,
            Map<UUID, Position> posMap,
            Map<UUID, KioskSetting> kioskMap,
            Map<String, String> faceDataMap
    ) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", o.getId());
        map.put("staffId", o.getStaffId());

        String managerId = o.getManagerId();
        String managerName = o.getManagerName();
        if ((managerId == null || managerId.isBlank()) && o.getStaffId() != null) {
            List<com.hrchomnan.backend.model.LeaveApprovalRule> indRules = leaveApprovalRuleRepository.findByTargetStaffId(o.getStaffId()).stream()
                    .filter(r -> "Employee".equalsIgnoreCase(r.getScope()))
                    .collect(Collectors.toList());
            if (!indRules.isEmpty()) {
                managerId = indRules.get(0).getApproverId();
            } else {
                Employee emp = employeeMap.get(o.getStaffId());
                if (emp != null && emp.getDepartmentId() != null) {
                    List<com.hrchomnan.backend.model.LeaveApprovalRule> deptRules = leaveApprovalRuleRepository.findByTargetDeptId(emp.getDepartmentId()).stream()
                            .filter(r -> "Department".equalsIgnoreCase(r.getScope()))
                            .collect(Collectors.toList());
                    if (!deptRules.isEmpty()) {
                        managerId = deptRules.get(0).getApproverId();
                    }
                }
            }
            if (managerId != null) {
                Employee mgr = employeeMap.get(managerId);
                if (mgr != null) {
                    managerName = mgr.getNameEn() != null ? mgr.getNameEn() : mgr.getNameKh();
                }
            }
        }

        map.put("managerId", managerId);
        map.put("managerName", managerName);
        map.put("branchId", o.getBranchId());
        map.put("branch", o.getBranch());
        map.put("fromDate", o.getFromDate());
        map.put("toDate", o.getToDate());
        map.put("startTime", o.getStartTime());
        map.put("endTime", o.getEndTime());
        map.put("amountDay", o.getAmountDay());
        map.put("reason", o.getReason());
        map.put("status", o.getStatus());
        map.put("comment", o.getComment());
        map.put("requestedAt", o.getRequestedAt());
        map.put("approvedAt", o.getApprovedAt());

        String creatorRaw = o.getCreatedBy();
        if (creatorRaw == null || creatorRaw.isBlank()) {
            creatorRaw = o.getStaffId();
        }
        Employee creatorEmp = creatorRaw != null ? employeeMap.get(creatorRaw) : null;
        String creatorDisplay = creatorRaw;
        if (creatorEmp != null) {
            creatorDisplay = (creatorEmp.getNameKh() != null && !creatorEmp.getNameKh().isBlank())
                    ? creatorEmp.getNameEn() + " (" + creatorEmp.getNameKh() + ")"
                    : creatorEmp.getNameEn();
        }
        map.put("createdBy", creatorDisplay);
        map.put("createdAt", o.getCreatedAt());
        map.put("updatedAt", o.getUpdatedAt());

        Employee emp = employeeMap.get(o.getStaffId());
        if (emp != null) {
            String photo = (emp.getPhotoUrl() != null && !emp.getPhotoUrl().isBlank())
                    ? emp.getPhotoUrl()
                    : faceDataMap.get(emp.getStaffId());
            Map<String, Object> empData = new HashMap<>();
            empData.put("staffId", emp.getStaffId());
            empData.put("nameEn", emp.getNameEn());
            empData.put("nameKh", emp.getNameKh());
            empData.put("photoUrl", photo);
            empData.put("role", emp.getRole() != null ? emp.getRole().name() : null);
            empData.put("email", emp.getEmail());
            empData.put("branch", emp.getBranch());

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

            map.put("employee", empData);
        } else {
            map.put("employee", null);
        }

        if (managerId != null) {
            Employee mgr = employeeMap.get(managerId);
            if (mgr != null) {
                map.put("manager", Map.of("staffId", mgr.getStaffId(), "nameEn", mgr.getNameEn(), "nameKh", mgr.getNameKh()));
            } else {
                map.put("manager", null);
            }
        } else {
            map.put("manager", null);
        }

        if (o.getBranchId() != null) {
            KioskSetting kiosk = kioskMap.get(o.getBranchId());
            if (kiosk != null) {
                map.put("branchLocation", Map.of("id", kiosk.getId(), "name", kiosk.getName()));
            } else {
                map.put("branchLocation", null);
            }
        } else {
            map.put("branchLocation", null);
        }

        return map;
    }
}
