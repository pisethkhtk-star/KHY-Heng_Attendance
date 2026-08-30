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
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/leaves")
@Transactional
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
    private final com.hrchomnan.backend.repository.EmployeeFaceDataRepository employeeFaceDataRepository;
    private final com.hrchomnan.backend.service.TelegramNotificationService telegramNotificationService;

    @GetMapping
    @PreAuthorize("@perm.has('leaves')")
    public ResponseEntity<List<Map<String, Object>>> getAllLeaves(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String departmentId,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestParam(required = false) String dateType
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
        Map<String, String> faceDataMap = employeeFaceDataRepository.findAll().stream()
                .filter(f -> f.getStaffId() != null && f.getPhotoUrl() != null)
                .collect(Collectors.toMap(com.hrchomnan.backend.model.EmployeeFaceData::getStaffId, com.hrchomnan.backend.model.EmployeeFaceData::getPhotoUrl, (a, b) -> a));

        if (departmentId != null && !departmentId.isBlank()) {
            try {
                UUID deptUuid = UUID.fromString(departmentId);
                list = list.stream().filter(l -> {
                    Employee e = empMap.get(l.getStaffId());
                    return e != null && deptUuid.equals(e.getDepartmentId());
                }).collect(Collectors.toList());
            } catch (Exception ignored) {}
        }

        if (startDate != null && !startDate.isBlank()) {
            try {
                LocalDate start = LocalDate.parse(startDate.trim());
                list = list.stream().filter(l -> {
                    LocalDate target = "leaveDate".equalsIgnoreCase(dateType)
                            ? l.getLeaveDate()
                            : (l.getRequestedAt() != null ? l.getRequestedAt().toLocalDate() : (l.getCreatedAt() != null ? l.getCreatedAt().toLocalDate() : l.getLeaveDate()));
                    return target != null && !target.isBefore(start);
                }).collect(Collectors.toList());
            } catch (Exception ignored) {}
        }

        if (endDate != null && !endDate.isBlank()) {
            try {
                LocalDate end = LocalDate.parse(endDate.trim());
                list = list.stream().filter(l -> {
                    LocalDate target = "leaveDate".equalsIgnoreCase(dateType)
                            ? l.getLeaveDate()
                            : (l.getRequestedAt() != null ? l.getRequestedAt().toLocalDate() : (l.getCreatedAt() != null ? l.getCreatedAt().toLocalDate() : l.getLeaveDate()));
                    return target != null && !target.isAfter(end);
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
                boolean rMatch = l.getReason() != null && l.getReason().toLowerCase().contains(query);
                boolean ldMatch = l.getLeaveDate() != null && l.getLeaveDate().toString().contains(query);
                boolean reqMatch = l.getRequestedAt() != null && l.getRequestedAt().toString().contains(query);
                return sMatch || nEnMatch || nKhMatch || rMatch || ldMatch || reqMatch;
            }).collect(Collectors.toList());
        }

        list.sort(Comparator.comparing(Leave::getLeaveDate, Comparator.nullsLast(Comparator.reverseOrder()))
                .thenComparing(Leave::getRequestedAt, Comparator.nullsLast(Comparator.reverseOrder())));

        List<Map<String, Object>> response = list.stream()
                .map(l -> enrichLeave(l, empMap, deptMap, posMap, faceDataMap))
                .collect(Collectors.toList());

        return ResponseEntity.ok(response);
    }

    @GetMapping("/employee/{staffId}")
    @PreAuthorize("@perm.has('leaves') or @perm.isSelfOrAdmin(#staffId)")
    public ResponseEntity<List<Map<String, Object>>> getByEmployee(@PathVariable String staffId) {
        List<Leave> list = leaveRepository.findByStaffId(staffId);
        list.sort(Comparator.comparing(Leave::getLeaveDate).reversed());

        Map<String, Employee> empMap = employeeRepository.findAll().stream()
                .collect(Collectors.toMap(Employee::getStaffId, e -> e, (a, b) -> a));
        Map<UUID, Department> deptMap = departmentRepository.findAll().stream()
                .collect(Collectors.toMap(Department::getId, d -> d, (a, b) -> a));
        Map<UUID, Position> posMap = positionRepository.findAll().stream()
                .collect(Collectors.toMap(Position::getId, p -> p, (a, b) -> a));
        Map<String, String> faceDataMap = employeeFaceDataRepository.findAll().stream()
                .filter(f -> f.getStaffId() != null && f.getPhotoUrl() != null)
                .collect(Collectors.toMap(com.hrchomnan.backend.model.EmployeeFaceData::getStaffId, com.hrchomnan.backend.model.EmployeeFaceData::getPhotoUrl, (a, b) -> a));

        List<Map<String, Object>> response = list.stream()
                .map(l -> enrichLeave(l, empMap, deptMap, posMap, faceDataMap))
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
        private String createdBy;
    }

    @PostMapping
    @PreAuthorize("@perm.has('add_leave') or @perm.isSelfOrAdmin(#request.staffId)")
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

        String creator = request.getCreatedBy() != null && !request.getCreatedBy().isBlank()
                ? request.getCreatedBy()
                : request.getStaffId();

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
                    .createdBy(creator)
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

        // Dispatch instant alert to Leave Telegram Group
        try {
            String dateRange = (resolvedStartDate.equals(resolvedEndDate))
                    ? resolvedStartDate
                    : resolvedStartDate + " to " + resolvedEndDate;
            Double totalDays = request.getAmountDays() != null ? request.getAmountDays() : (double) dates.size();
            telegramNotificationService.sendLeaveRequestNotification(
                    empOpt.get(),
                    request.getLeaveType(),
                    dateRange,
                    durType,
                    totalDays,
                    request.getReason()
            );
        } catch (Exception e) {
            log.error("Error sending Telegram leave notification:", e);
        }

        return ResponseEntity.status(HttpStatus.CREATED).body(enrichLeave(createdLeaves.get(0), empMap, deptMap, posMap));
    }

    @Data
    public static class StatusUpdateRequest {
        private String status; // Approved, Rejected
        private String managerName;
    }

    @PutMapping("/{id}/status")
    @PreAuthorize("@perm.has('approve_leaves') or hasAnyRole('Admin', 'HR', 'Manager')")
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
                    .filter(r -> "Employee".equalsIgnoreCase(r.getScope()) && ("LEAVE".equalsIgnoreCase(r.getRuleType()) || r.getRuleType() == null))
                    .collect(Collectors.toList());

            List<LeaveApprovalRule> deptRules = (employee.getDepartmentId() != null)
                    ? leaveApprovalRuleRepository.findByTargetDeptId(employee.getDepartmentId()).stream()
                    .filter(r -> "Department".equalsIgnoreCase(r.getScope()) && ("LEAVE".equalsIgnoreCase(r.getRuleType()) || r.getRuleType() == null))
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
        } else if (newStatus == LeaveStatus.Rejected) {
            cleanUpAttendanceLeave(leave.getStaffId(), leave.getLeaveDate(), leave.getId());
        }

        Map<String, Employee> empMap = Map.of(employee.getStaffId(), employee);
        Map<UUID, Department> deptMap = departmentRepository.findAll().stream().collect(Collectors.toMap(Department::getId, d -> d, (a, b) -> a));
        Map<UUID, Position> posMap = positionRepository.findAll().stream().collect(Collectors.toMap(Position::getId, p -> p, (a, b) -> a));

        // Dispatch status update alert to Leave Telegram Group
        try {
            telegramNotificationService.sendLeaveApprovalNotification(
                    employee,
                    leave.getLeaveType(),
                    leave.getLeaveDate() != null ? leave.getLeaveDate().toString() : "-",
                    newStatus.name(),
                    leave.getManagerName(),
                    leave.getReason()
            );
        } catch (Exception e) {
            log.error("Error sending Telegram leave status notification:", e);
        }

        return ResponseEntity.ok(enrichLeave(updated, empMap, deptMap, posMap));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
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

        cleanUpAttendanceLeave(leave.getStaffId(), leave.getLeaveDate(), leave.getId());
        leaveRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("success", true, "message", "Leave request deleted successfully"));
    }

    private void cleanUpAttendanceLeave(String staffId, LocalDate leaveDate, UUID excludeLeaveId) {
        if (staffId == null || leaveDate == null) return;
        try {
            Optional<Attendance> existingAtt = attendanceRepository.findByStaffIdAndAttendanceDate(staffId, leaveDate);
            if (existingAtt.isPresent()) {
                Attendance att = existingAtt.get();

                // Check if any other approved leave still exists for this staff on this date
                List<Leave> otherApproved = leaveRepository.findByStaffId(staffId).stream()
                        .filter(l -> !l.getId().equals(excludeLeaveId) &&
                                leaveDate.equals(l.getLeaveDate()) &&
                                l.getStatus() == LeaveStatus.Approved)
                        .collect(Collectors.toList());

                if (otherApproved.isEmpty()) {
                    if (att.getNote() != null) {
                        String cleanNote = Arrays.stream(att.getNote().split("\\|"))
                                .map(String::trim)
                                .filter(part -> !part.toLowerCase().contains("leave"))
                                .collect(Collectors.joining(" | "));

                        boolean hasScans = (att.getCheckin1() != null && !att.getCheckin1().isBlank() && !"-".equals(att.getCheckin1())) ||
                                (att.getCheckout1() != null && !att.getCheckout1().isBlank() && !"-".equals(att.getCheckout1())) ||
                                (att.getCheckin2() != null && !att.getCheckin2().isBlank() && !"-".equals(att.getCheckin2())) ||
                                (att.getCheckout2() != null && !att.getCheckout2().isBlank() && !"-".equals(att.getCheckout2()));

                        if (!hasScans && cleanNote.isBlank()) {
                            attendanceRepository.delete(att);
                        } else {
                            att.setNote(cleanNote.isBlank() ? null : cleanNote);
                            attendanceRepository.save(att);
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.error("Error cleaning up attendance for leave:", e);
        }
    }

    private Map<String, Object> enrichLeave(
            Leave l,
            Map<String, Employee> empMap,
            Map<UUID, Department> deptMap,
            Map<UUID, Position> posMap
    ) {
        Map<String, String> faceDataMap = employeeFaceDataRepository.findAll().stream()
                .filter(f -> f.getStaffId() != null && f.getPhotoUrl() != null)
                .collect(Collectors.toMap(com.hrchomnan.backend.model.EmployeeFaceData::getStaffId, com.hrchomnan.backend.model.EmployeeFaceData::getPhotoUrl, (a, b) -> a));
        return enrichLeave(l, empMap, deptMap, posMap, faceDataMap);
    }

    private Map<String, Object> enrichLeave(
            Leave l,
            Map<String, Employee> empMap,
            Map<UUID, Department> deptMap,
            Map<UUID, Position> posMap,
            Map<String, String> faceDataMap
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

        String creatorRaw = l.getCreatedBy();
        if (creatorRaw == null || creatorRaw.isBlank()) {
            creatorRaw = l.getStaffId();
        }
        Employee creatorEmp = creatorRaw != null ? empMap.get(creatorRaw) : null;
        String creatorDisplay = creatorRaw;
        if (creatorEmp != null) {
            creatorDisplay = (creatorEmp.getNameKh() != null && !creatorEmp.getNameKh().isBlank())
                    ? creatorEmp.getNameEn() + " (" + creatorEmp.getNameKh() + ")"
                    : creatorEmp.getNameEn();
        }
        map.put("createdBy", creatorDisplay);
        map.put("createdAt", l.getCreatedAt());
        map.put("updatedAt", l.getUpdatedAt());

        Employee emp = empMap.get(l.getStaffId());
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

        return map;
    }
}
