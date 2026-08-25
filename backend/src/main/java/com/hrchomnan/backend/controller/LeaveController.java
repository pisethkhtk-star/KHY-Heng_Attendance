package com.hrchomnan.backend.controller;

import com.hrchomnan.backend.enums.LeaveStatus;
import com.hrchomnan.backend.enums.Role;
import com.hrchomnan.backend.model.*;
import com.hrchomnan.backend.repository.*;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/leaves")
@RequiredArgsConstructor
@Slf4j
public class LeaveController {

    private final LeaveRepository leaveRepository;
    private final EmployeeRepository employeeRepository;
    private final AttendanceRepository attendanceRepository;
    private final DepartmentRepository departmentRepository;
    private final PositionRepository positionRepository;
    private final LeaveTypeRepository leaveTypeRepository;
    private final EmployeeLeaveLimitRepository leaveLimitRepository;
    private final LeaveApprovalRuleRepository leaveApprovalRuleRepository;

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getAllLeaves(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String departmentId
    ) {
        List<Leave> list = leaveRepository.findAll();

        if (status != null && !status.isBlank()) {
            try {
                LeaveStatus ls = LeaveStatus.valueOf(status);
                list = list.stream().filter(l -> l.getStatus() == ls).collect(Collectors.toList());
            } catch (IllegalArgumentException ignored) {}
        }

        Map<String, Employee> empMap = employeeRepository.findAll().stream()
                .collect(Collectors.toMap(Employee::getStaffId, e -> e, (a, b) -> a));
        Map<UUID, Department> deptMap = departmentRepository.findAll().stream()
                .collect(Collectors.toMap(Department::getId, d -> d, (a, b) -> a));
        Map<UUID, Position> posMap = positionRepository.findAll().stream()
                .collect(Collectors.toMap(Position::getId, p -> p, (a, b) -> a));

        if (departmentId != null && !departmentId.isBlank()) {
            try {
                UUID deptUuid = UUID.fromString(departmentId);
                list = list.stream().filter(l -> {
                    Employee e = empMap.get(l.getStaffId());
                    return e != null && deptUuid.equals(e.getDepartmentId());
                }).collect(Collectors.toList());
            } catch (Exception ignored) {}
        }

        if (search != null && !search.isBlank()) {
            final String query = search.trim().toLowerCase();
            list = list.stream().filter(l -> {
                Employee e = empMap.get(l.getStaffId());
                boolean sMatch = l.getStaffId() != null && l.getStaffId().toLowerCase().contains(query);
                boolean nEnMatch = e != null && e.getNameEn() != null && e.getNameEn().toLowerCase().contains(query);
                boolean nKhMatch = e != null && e.getNameKh() != null && e.getNameKh().toLowerCase().contains(query);
                return sMatch || nEnMatch || nKhMatch;
            }).collect(Collectors.toList());
        }

        list.sort(Comparator.comparing(Leave::getRequestedAt, Comparator.nullsLast(Comparator.reverseOrder())));

        List<Map<String, Object>> response = list.stream()
                .map(l -> enrichLeave(l, empMap, deptMap, posMap))
                .collect(Collectors.toList());

        return ResponseEntity.ok(response);
    }

    @GetMapping("/employee/{staffId}")
    public ResponseEntity<List<Map<String, Object>>> getByEmployee(@PathVariable String staffId) {
        List<Leave> list = leaveRepository.findByStaffId(staffId);
        list.sort(Comparator.comparing(Leave::getLeaveDate).reversed());

        Map<String, Employee> empMap = employeeRepository.findAll().stream()
                .collect(Collectors.toMap(Employee::getStaffId, e -> e, (a, b) -> a));
        Map<UUID, Department> deptMap = departmentRepository.findAll().stream()
                .collect(Collectors.toMap(Department::getId, d -> d, (a, b) -> a));
        Map<UUID, Position> posMap = positionRepository.findAll().stream()
                .collect(Collectors.toMap(Position::getId, p -> p, (a, b) -> a));

        List<Map<String, Object>> response = list.stream()
                .map(l -> enrichLeave(l, empMap, deptMap, posMap))
                .collect(Collectors.toList());

        return ResponseEntity.ok(response);
    }

    @Data
    public static class CreateLeaveRequest {
        private String staffId;
        private String leaveDate;
        private String startDate;
        private String endDate;
        private String durationType = "Full Day"; // Full Day, Morning, Afternoon
        private String leaveType;
        private Double amountDays;
        private String reason;
    }

    @PostMapping
    public ResponseEntity<?> createLeave(@RequestBody CreateLeaveRequest request) {
        String resolvedStartDate = request.getStartDate() != null && !request.getStartDate().isBlank()
                ? request.getStartDate()
                : request.getLeaveDate();
        String resolvedEndDate = request.getEndDate() != null && !request.getEndDate().isBlank()
                ? request.getEndDate()
                : request.getLeaveDate();

        if (request.getStaffId() == null || resolvedStartDate == null || resolvedEndDate == null || request.getLeaveType() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Required fields are missing"));
        }

        Optional<Employee> empOpt = employeeRepository.findByStaffId(request.getStaffId());
        if (empOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Employee not found"));
        }

        LocalDate start;
        LocalDate end;
        try {
            start = LocalDate.parse(resolvedStartDate.trim());
            end = LocalDate.parse(resolvedEndDate.trim());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", "Invalid date formats provided"));
        }

        if (start.isAfter(end)) {
            return ResponseEntity.badRequest().body(Map.of("message", "Start date must be before or equal to end date"));
        }

        List<LocalDate> dates = new ArrayList<>();
        LocalDate curr = start;
        while (!curr.isAfter(end)) {
            dates.add(curr);
            curr = curr.plusDays(1);
        }

        String durType = request.getDurationType() != null ? request.getDurationType() : "Full Day";
        BigDecimal amountDaysPerDay = BigDecimal.ONE;
        if ("Morning".equalsIgnoreCase(durType) || "Afternoon".equalsIgnoreCase(durType)) {
            amountDaysPerDay = new BigDecimal("0.5");
        } else if (request.getAmountDays() != null && !dates.isEmpty()) {
            amountDaysPerDay = BigDecimal.valueOf(request.getAmountDays() / dates.size());
        }

        // Validate leave type and max days limit
        Optional<LeaveType> typeInfoOpt = leaveTypeRepository.findAll().stream()
                .filter(lt -> lt.getCode().equalsIgnoreCase(request.getLeaveType()) || lt.getNameEn().equalsIgnoreCase(request.getLeaveType()))
                .findFirst();

        if (typeInfoOpt.isPresent()) {
            LeaveType typeInfo = typeInfoOpt.get();
            int targetYear = start.getYear();
            LocalDate yrStart = LocalDate.of(targetYear, 1, 1);
            LocalDate yrEnd = LocalDate.of(targetYear, 12, 31);

            List<Leave> existingLeaves = leaveRepository.findByStaffId(request.getStaffId()).stream()
                    .filter(l -> (l.getLeaveType().equalsIgnoreCase(typeInfo.getCode()) || l.getLeaveType().equalsIgnoreCase(typeInfo.getNameEn()))
                            && (l.getStatus() == LeaveStatus.Pending || l.getStatus() == LeaveStatus.Approved)
                            && l.getLeaveDate() != null
                            && !l.getLeaveDate().isBefore(yrStart) && !l.getLeaveDate().isAfter(yrEnd))
                    .collect(Collectors.toList());

            double totalUsedDays = existingLeaves.stream()
                    .mapToDouble(l -> l.getAmountDays() != null ? l.getAmountDays().doubleValue() : 1.0)
                    .sum();

            double requestedDays = dates.size() * amountDaysPerDay.doubleValue();

            Optional<EmployeeLeaveLimit> customOverride = leaveLimitRepository.findAll().stream()
                    .filter(lim -> request.getStaffId().equalsIgnoreCase(lim.getStaffId()) && typeInfo.getCode().equalsIgnoreCase(lim.getLeaveCode()))
                    .findFirst();

            double allowedLimit = customOverride.map(EmployeeLeaveLimit::getMaxDays)
                    .orElse(typeInfo.getMaxDays() != null ? typeInfo.getMaxDays() : 18.0);

            if (totalUsedDays + requestedDays > allowedLimit) {
                return ResponseEntity.badRequest().body(Map.of(
                        "message", "អ្នកបានស្នើច្បាប់ហួសការកំណត់! (Exceeded leave limit). You have used " +
                                totalUsedDays + " days out of " + allowedLimit + " allowed days for '" +
                                (typeInfo.getNameKh() != null ? typeInfo.getNameKh() : typeInfo.getNameEn()) + "' in " + targetYear + ". You requested " + requestedDays + " days."
                ));
            }
        }

        List<Leave> createdLeaves = new ArrayList<>();
        for (LocalDate d : dates) {
            String finalReason = request.getReason();
            if ("Morning".equalsIgnoreCase(durType) || "Afternoon".equalsIgnoreCase(durType)) {
                finalReason = (request.getReason() != null && !request.getReason().isBlank())
                        ? request.getReason() + " (" + durType + ")"
                        : "(" + durType + ")";
            }

            Leave leave = Leave.builder()
                    .staffId(request.getStaffId())
                    .leaveDate(d)
                    .leaveType(request.getLeaveType())
                    .amountDays(amountDaysPerDay)
                    .reason(finalReason)
                    .status(LeaveStatus.Pending)
                    .requestedAt(LocalDateTime.now())
                    .build();

            Leave saved = leaveRepository.save(leave);
            createdLeaves.add(saved);

            // Sync attendance record
            try {
                Optional<Attendance> existingAtt = attendanceRepository.findByStaffIdAndAttendanceDate(request.getStaffId(), d);
                String noteText = "Leave: " + request.getLeaveType() + " (" + durType + ")";
                Attendance att = existingAtt.orElseGet(() -> Attendance.builder()
                        .staffId(request.getStaffId())
                        .attendanceDate(d)
                        .build());

                String newNote = (att.getNote() != null && !att.getNote().isBlank()) ? att.getNote() + " | " + noteText : noteText;
                att.setNote(newNote);

                if ("Morning".equalsIgnoreCase(durType)) {
                    att.setCheckin1(null);
                    att.setCheckout1(null);
                } else if ("Afternoon".equalsIgnoreCase(durType)) {
                    att.setCheckin2(null);
                    att.setCheckout2(null);
                } else {
                    att.setCheckin1(null);
                    att.setCheckout1(null);
                    att.setCheckin2(null);
                    att.setCheckout2(null);
                }
                attendanceRepository.save(att);
            } catch (Exception e) {
                log.error("Error overriding attendance on leave create:", e);
            }
        }

        Map<String, Employee> empMap = Map.of(empOpt.get().getStaffId(), empOpt.get());
        Map<UUID, Department> deptMap = departmentRepository.findAll().stream().collect(Collectors.toMap(Department::getId, d -> d, (a, b) -> a));
        Map<UUID, Position> posMap = positionRepository.findAll().stream().collect(Collectors.toMap(Position::getId, p -> p, (a, b) -> a));

        return ResponseEntity.status(HttpStatus.CREATED).body(enrichLeave(createdLeaves.get(0), empMap, deptMap, posMap));
    }

    @Data
    public static class StatusUpdateRequest {
        private String status; // Approved, Rejected
        private String managerName;
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<?> updateStatus(
            @PathVariable UUID id,
            @RequestBody StatusUpdateRequest request,
            Authentication authentication
    ) {
        if (request.getStatus() == null || (!"Approved".equalsIgnoreCase(request.getStatus()) && !"Rejected".equalsIgnoreCase(request.getStatus()))) {
            return ResponseEntity.badRequest().body(Map.of("message", "Valid status (Approved or Rejected) is required"));
        }

        LeaveStatus newStatus = LeaveStatus.valueOf(request.getStatus().substring(0, 1).toUpperCase() + request.getStatus().substring(1).toLowerCase());

        Optional<Leave> leaveOpt = leaveRepository.findById(id);
        if (leaveOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Leave request not found"));
        }
        Leave leave = leaveOpt.get();

        Optional<Employee> empOpt = employeeRepository.findByStaffId(leave.getStaffId());
        if (empOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Employee associated with leave not found"));
        }
        Employee employee = empOpt.get();

        // Approver validation (Admins can bypass)
        Employee currentUser = (authentication != null && authentication.getPrincipal() instanceof Employee emp) ? emp : null;
        if (currentUser != null && currentUser.getRole() != Role.Admin) {
            List<LeaveApprovalRule> indRules = leaveApprovalRuleRepository.findByTargetStaffId(leave.getStaffId()).stream()
                    .filter(r -> "Employee".equalsIgnoreCase(r.getScope()))
                    .collect(Collectors.toList());

            List<LeaveApprovalRule> deptRules = (employee.getDepartmentId() != null)
                    ? leaveApprovalRuleRepository.findByTargetDeptId(employee.getDepartmentId()).stream()
                    .filter(r -> "Department".equalsIgnoreCase(r.getScope()))
                    .collect(Collectors.toList())
                    : Collections.emptyList();

            Set<String> allowedApprovers = new HashSet<>();
            indRules.forEach(r -> allowedApprovers.add(r.getApproverId().toLowerCase()));
            deptRules.forEach(r -> allowedApprovers.add(r.getApproverId().toLowerCase()));

            if (!allowedApprovers.isEmpty() && !allowedApprovers.contains(currentUser.getStaffId().toLowerCase())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                        "message", "អ្នកមិនមានសិទ្ធិអនុម័តច្បាប់របស់បុគ្គលិកនេះទេ! (You are not the designated approver for this employee)"
                ));
            }
        }

        leave.setStatus(newStatus);
        leave.setManagerName(request.getManagerName() != null ? request.getManagerName() : (currentUser != null ? currentUser.getNameEn() : "System Admin"));
        leave.setApprovedAt(LocalDateTime.now());
        Leave updated = leaveRepository.save(leave);

        if (newStatus == LeaveStatus.Approved) {
            try {
                LocalDate d = leave.getLeaveDate();
                boolean isMorning = (leave.getReason() != null && leave.getReason().contains("(Morning)")) ||
                        (leave.getAmountDays() != null && leave.getAmountDays().doubleValue() == 0.5);
                boolean isAfternoon = leave.getReason() != null && leave.getReason().contains("(Afternoon)");
                String noteText = "Approved Leave: " + leave.getLeaveType() + " (" + (isMorning ? "Morning" : isAfternoon ? "Afternoon" : "Full Day") + ")";

                Optional<Attendance> existingAtt = attendanceRepository.findByStaffIdAndAttendanceDate(leave.getStaffId(), d);
                Attendance att = existingAtt.orElseGet(() -> Attendance.builder()
                        .staffId(leave.getStaffId())
                        .attendanceDate(d)
                        .build());

                String newNote = (att.getNote() != null && !att.getNote().isBlank()) ? att.getNote() + " | " + noteText : noteText;
                att.setNote(newNote);

                if (isMorning) {
                    att.setCheckin1(null);
                    att.setCheckout1(null);
                } else if (isAfternoon) {
                    att.setCheckin2(null);
                    att.setCheckout2(null);
                } else {
                    att.setCheckin1(null);
                    att.setCheckout1(null);
                    att.setCheckin2(null);
                    att.setCheckout2(null);
                }
                attendanceRepository.save(att);
            } catch (Exception e) {
                log.error("Error updating attendance on leave approval:", e);
            }
        }

        Map<String, Employee> empMap = Map.of(employee.getStaffId(), employee);
        Map<UUID, Department> deptMap = departmentRepository.findAll().stream().collect(Collectors.toMap(Department::getId, d -> d, (a, b) -> a));
        Map<UUID, Position> posMap = positionRepository.findAll().stream().collect(Collectors.toMap(Position::getId, p -> p, (a, b) -> a));

        return ResponseEntity.ok(enrichLeave(updated, empMap, deptMap, posMap));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteLeave(@PathVariable UUID id, Authentication authentication) {
        Optional<Leave> leaveOpt = leaveRepository.findById(id);
        if (leaveOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Leave request not found"));
        }

        Leave leave = leaveOpt.get();
        Employee currentUser = (authentication != null && authentication.getPrincipal() instanceof Employee emp) ? emp : null;

        if (currentUser != null && currentUser.getRole() == Role.Employee) {
            if (!leave.getStaffId().equalsIgnoreCase(currentUser.getStaffId())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Access denied. You can only cancel your own leave requests."));
            }
            if (leave.getStatus() != LeaveStatus.Pending) {
                return ResponseEntity.badRequest().body(Map.of("message", "You can only cancel pending leave requests."));
            }
        }

        leaveRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("success", true, "message", "Leave request cancelled successfully"));
    }

    private Map<String, Object> enrichLeave(
            Leave l,
            Map<String, Employee> empMap,
            Map<UUID, Department> deptMap,
            Map<UUID, Position> posMap
    ) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", l.getId());
        map.put("staffId", l.getStaffId());
        map.put("leaveDate", l.getLeaveDate());
        map.put("leaveType", l.getLeaveType());
        map.put("amountDays", l.getAmountDays());
        map.put("reason", l.getReason());
        map.put("status", l.getStatus());
        map.put("managerName", l.getManagerName());
        map.put("requestedAt", l.getRequestedAt());
        map.put("approvedAt", l.getApprovedAt());
        map.put("createdAt", l.getCreatedAt());
        map.put("updatedAt", l.getUpdatedAt());

        Employee emp = empMap.get(l.getStaffId());
        if (emp != null) {
            Map<String, Object> empData = new HashMap<>();
            empData.put("staffId", emp.getStaffId());
            empData.put("nameEn", emp.getNameEn());
            empData.put("nameKh", emp.getNameKh());
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

        return map;
    }
}
