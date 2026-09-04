package com.hrchomnan.backend.controller;

import com.hrchomnan.backend.enums.LeaveStatus;
import com.hrchomnan.backend.enums.Status;
import com.hrchomnan.backend.enums.Role;
import com.hrchomnan.backend.model.Attendance;
import com.hrchomnan.backend.model.Department;
import com.hrchomnan.backend.model.Employee;
import com.hrchomnan.backend.model.Position;
import com.hrchomnan.backend.model.CompanyWorkHour;
import com.hrchomnan.backend.model.LeaveApprovalRule;
import com.hrchomnan.backend.repository.AttendanceRepository;
import com.hrchomnan.backend.repository.CompanyWorkHourRepository;
import com.hrchomnan.backend.repository.DepartmentRepository;
import com.hrchomnan.backend.repository.EmployeeRepository;
import com.hrchomnan.backend.repository.LeaveRepository;
import com.hrchomnan.backend.repository.PositionRepository;
import com.hrchomnan.backend.repository.LeaveApprovalRuleRepository;
import com.hrchomnan.backend.util.AttendanceHelper;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/attendances")
@Transactional
@RequiredArgsConstructor
public class AttendanceController {

    private final AttendanceRepository attendanceRepository;
    private final EmployeeRepository employeeRepository;
    private final DepartmentRepository departmentRepository;
    private final PositionRepository positionRepository;
    private final LeaveRepository leaveRepository;
    private final CompanyWorkHourRepository companyWorkHourRepository;
    private final LeaveApprovalRuleRepository leaveApprovalRuleRepository;
    private final AttendanceHelper attendanceHelper;

    @Data
    public static class LogRequest {
        private String staffId;
        private String action; // checkin_1, checkout_1, checkin_2, checkout_2
        private String customTime;
        private String customDate;
        private String note;
    }

    @PostMapping("/log")
    @PreAuthorize("@perm.has('add_attendance') or hasAnyRole('Admin', 'HR') or @perm.isSelfOrAdmin(#request.staffId) or @perm.canCheckinOnBehalf(#request.staffId)")
    public ResponseEntity<?> logCheckInOut(@RequestBody LogRequest request) {
        if (request.getStaffId() == null || request.getAction() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Staff ID and Action are required"));
        }

        String rawAction = request.getAction().toLowerCase().trim();
        if (rawAction.equals("check_in_1")) rawAction = "checkin_1";
        if (rawAction.equals("check_out_1")) rawAction = "checkout_1";
        if (rawAction.equals("check_in_2")) rawAction = "checkin_2";
        if (rawAction.equals("check_out_2")) rawAction = "checkout_2";
        request.setAction(rawAction);

        List<String> validActions = List.of("checkin_1", "checkout_1", "checkin_2", "checkout_2");
        if (!validActions.contains(request.getAction())) {
            return ResponseEntity.badRequest().body(Map.of("message", "Invalid action. Must be checkin_1, checkout_1, checkin_2, or checkout_2"));
        }

        try {
            AttendanceHelper.ScanResult result = attendanceHelper.processAttendanceScan(
                    request.getStaffId(),
                    request.getAction(),
                    request.getCustomTime(),
                    request.getCustomDate(),
                    request.getNote()
            );

            Map<UUID, Department> deptMap = departmentRepository.findAll().stream().collect(Collectors.toMap(Department::getId, d -> d, (a, b) -> a));
            Map<UUID, Position> posMap = positionRepository.findAll().stream().collect(Collectors.toMap(Position::getId, p -> p, (a, b) -> a));
            Map<String, Employee> empMap = Map.of(result.getEmployee().getStaffId(), result.getEmployee());

            return ResponseEntity.ok(Map.of(
                    "message", "Successfully logged " + result.getAction() + " at " + result.getTimeString(),
                    "data", enrichAttendance(result.getAttendance(), empMap, deptMap, posMap)
            ));
        } catch (RuntimeException e) {
            if ("Employee not found".equals(e.getMessage())) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Employee not found"));
            }
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("message", "Server error logging attendance"));
        }
    }

    @GetMapping("/checkin-on-behalf/eligible-employees")
    public ResponseEntity<?> getEligibleEmployeesForCheckinOnBehalf(
            @AuthenticationPrincipal Employee principal
    ) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        Employee currentEmp = principal;
        if (currentEmp == null && auth != null && auth.getPrincipal() instanceof Employee emp) {
            currentEmp = emp;
        }
        if (currentEmp == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Unauthorized"));
        }

        Employee freshEmp = employeeRepository.findById(currentEmp.getId()).orElse(currentEmp);
        String staffId = freshEmp.getStaffId();

        // 1. Fetch rules for Check-in on Behalf (ruleType = 'CHECKIN')
        List<LeaveApprovalRule> checkinRules = leaveApprovalRuleRepository.findByRuleType("CHECKIN");
        List<LeaveApprovalRule> userRules = checkinRules.stream()
                .filter(r -> staffId != null && staffId.equalsIgnoreCase(r.getApproverId()))
                .collect(Collectors.toList());

        // 2. Permission is strictly derived from the Check-in on Behalf approval hierarchy
        boolean canCheckinOnBehalf = !userRules.isEmpty();

        // Fallback for Admin/HR only if NO Check-in on Behalf rules exist in the entire system yet
        if (!canCheckinOnBehalf && checkinRules.isEmpty() && (freshEmp.getRole() == Role.Admin || freshEmp.getRole() == Role.HR)) {
            canCheckinOnBehalf = true;
        }

        if (!canCheckinOnBehalf) {
            return ResponseEntity.ok(Map.of(
                    "canCheckinOnBehalf", false,
                    "eligibleEmployees", List.of()
            ));
        }

        List<Employee> allEmployees = employeeRepository.findAll().stream()
                .filter(e -> e.getStatus() == null || e.getStatus() == Status.Active)
                .collect(Collectors.toList());

        List<Employee> eligibleList;
        if (!userRules.isEmpty()) {
            Set<String> allowedStaffIds = new HashSet<>();
            Set<UUID> allowedDeptIds = new HashSet<>();
            for (LeaveApprovalRule rule : userRules) {
                if ("Employee".equalsIgnoreCase(rule.getScope()) && rule.getTargetStaffId() != null) {
                    allowedStaffIds.add(rule.getTargetStaffId().trim().toUpperCase());
                } else if ("Department".equalsIgnoreCase(rule.getScope()) && rule.getTargetDeptId() != null) {
                    allowedDeptIds.add(rule.getTargetDeptId());
                }
            }

            eligibleList = allEmployees.stream().filter(e -> {
                if (e.getStaffId() != null && allowedStaffIds.contains(e.getStaffId().trim().toUpperCase())) return true;
                if (e.getDepartmentId() != null && allowedDeptIds.contains(e.getDepartmentId())) return true;
                return false;
            }).collect(Collectors.toList());
        } else {
            eligibleList = allEmployees;
        }

        Map<UUID, Department> deptMap = departmentRepository.findAll().stream().collect(Collectors.toMap(Department::getId, d -> d, (a, b) -> a));
        Map<UUID, Position> posMap = positionRepository.findAll().stream().collect(Collectors.toMap(Position::getId, p -> p, (a, b) -> a));

        List<Map<String, Object>> resultList = eligibleList.stream().map(e -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", e.getId());
            m.put("staffId", e.getStaffId());
            m.put("nameEn", e.getNameEn() != null ? e.getNameEn() : "");
            m.put("nameKh", e.getNameKh() != null ? e.getNameKh() : "");
            m.put("fullName", e.getNameKh() != null && !e.getNameKh().isBlank() ? e.getNameKh() : (e.getNameEn() != null ? e.getNameEn() : ""));
            m.put("department", e.getDepartmentId() != null && deptMap.containsKey(e.getDepartmentId()) ? deptMap.get(e.getDepartmentId()).getNameEn() : "-");
            m.put("position", e.getPositionId() != null && posMap.containsKey(e.getPositionId()) ? posMap.get(e.getPositionId()).getTitleEn() : "-");
            m.put("avatar", e.getPhotoUrl());
            m.put("shift1Start", e.getShift1Start());
            m.put("shift1End", e.getShift1End());
            m.put("shift2Start", e.getShift2Start());
            m.put("shift2End", e.getShift2End());
            return m;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(Map.of(
                "canCheckinOnBehalf", true,
                "eligibleEmployees", resultList
        ));
    }

    @GetMapping("/today")
    @PreAuthorize("@perm.has('attendance')")
    public ResponseEntity<List<Map<String, Object>>> getTodayAttendance(
            @RequestParam(required = false) String departmentId,
            @RequestParam(required = false) String branch
    ) {
        LocalDate today = attendanceHelper.getLocalTimeDetails(null, null).getDate();
        List<Attendance> list = attendanceRepository.findByAttendanceDate(today);

        Map<String, Employee> empMap = employeeRepository.findAll().stream()
                .collect(Collectors.toMap(Employee::getStaffId, e -> e, (a, b) -> a));
        Map<UUID, Department> deptMap = departmentRepository.findAll().stream()
                .collect(Collectors.toMap(Department::getId, d -> d, (a, b) -> a));
        Map<UUID, Position> posMap = positionRepository.findAll().stream()
                .collect(Collectors.toMap(Position::getId, p -> p, (a, b) -> a));

        if (departmentId != null && !departmentId.isBlank()) {
            try {
                UUID deptUuid = UUID.fromString(departmentId);
                list = list.stream().filter(a -> {
                    Employee e = empMap.get(a.getStaffId());
                    return e != null && deptUuid.equals(e.getDepartmentId());
                }).collect(Collectors.toList());
            } catch (Exception ignored) {}
        }

        if (branch != null && !branch.isBlank()) {
            final String b = branch.trim().toLowerCase();
            list = list.stream().filter(a -> {
                Employee e = empMap.get(a.getStaffId());
                return e != null && e.getBranch() != null && e.getBranch().toLowerCase().contains(b);
            }).collect(Collectors.toList());
        }

        List<Map<String, Object>> response = list.stream()
                .map(a -> enrichAttendance(a, empMap, deptMap, posMap))
                .collect(Collectors.toList());

        return ResponseEntity.ok(response);
    }

    @GetMapping("/history")
    @PreAuthorize("@perm.has('attendance') or (authentication != null and @perm.isSelfOrAdmin(#staffId))")
    public ResponseEntity<List<Map<String, Object>>> getHistory(
            @RequestParam(required = false) String staffId,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestParam(required = false) String departmentId,
            @RequestParam(required = false) String branch
    ) {
        List<Attendance> list = attendanceRepository.findAll();

        Map<String, Employee> empMap = employeeRepository.findAll().stream()
                .collect(Collectors.toMap(Employee::getStaffId, e -> e, (a, b) -> a));
        Map<UUID, Department> deptMap = departmentRepository.findAll().stream()
                .collect(Collectors.toMap(Department::getId, d -> d, (a, b) -> a));
        Map<UUID, Position> posMap = positionRepository.findAll().stream()
                .collect(Collectors.toMap(Position::getId, p -> p, (a, b) -> a));

        String query = (search != null && !search.isBlank()) ? search.trim().toLowerCase() : (staffId != null ? staffId.trim().toLowerCase() : null);
        if (query != null) {
            list = list.stream().filter(a -> {
                Employee e = empMap.get(a.getStaffId());
                boolean sMatch = a.getStaffId() != null && a.getStaffId().toLowerCase().contains(query);
                boolean nEnMatch = e != null && e.getNameEn() != null && e.getNameEn().toLowerCase().contains(query);
                boolean nKhMatch = e != null && e.getNameKh() != null && e.getNameKh().toLowerCase().contains(query);
                return sMatch || nEnMatch || nKhMatch;
            }).collect(Collectors.toList());
        }

        if (startDate != null && !startDate.isBlank()) {
            LocalDate sDate = LocalDate.parse(startDate);
            list = list.stream().filter(a -> !a.getAttendanceDate().isBefore(sDate)).collect(Collectors.toList());
        }

        if (endDate != null && !endDate.isBlank()) {
            LocalDate eDate = LocalDate.parse(endDate);
            list = list.stream().filter(a -> !a.getAttendanceDate().isAfter(eDate)).collect(Collectors.toList());
        }

        if (departmentId != null && !departmentId.isBlank()) {
            try {
                UUID deptUuid = UUID.fromString(departmentId);
                list = list.stream().filter(a -> {
                    Employee e = empMap.get(a.getStaffId());
                    return e != null && deptUuid.equals(e.getDepartmentId());
                }).collect(Collectors.toList());
            } catch (Exception ignored) {}
        }

        if (branch != null && !branch.isBlank()) {
            final String b = branch.trim().toLowerCase();
            list = list.stream().filter(a -> {
                Employee e = empMap.get(a.getStaffId());
                return e != null && e.getBranch() != null && e.getBranch().toLowerCase().contains(b);
            }).collect(Collectors.toList());
        }

        // Only include attendance logs that have at least one check-in or check-out timestamp
        list = list.stream().filter(a ->
                (a.getCheckin1() != null && !a.getCheckin1().isBlank()) ||
                (a.getCheckout1() != null && !a.getCheckout1().isBlank()) ||
                (a.getCheckin2() != null && !a.getCheckin2().isBlank()) ||
                (a.getCheckout2() != null && !a.getCheckout2().isBlank())
        ).collect(Collectors.toList());

        list.sort(Comparator.comparing(Attendance::getAttendanceDate).reversed()
                .thenComparing(Attendance::getStaffId, Comparator.nullsLast(String::compareToIgnoreCase)));

        List<Map<String, Object>> response = list.stream()
                .map(a -> enrichAttendance(a, empMap, deptMap, posMap))
                .collect(Collectors.toList());

        return ResponseEntity.ok(response);
    }

    @GetMapping("/stats-summary")
    @PreAuthorize("@perm.has('attendance')")
    public ResponseEntity<Map<String, Object>> getStatsSummary() {
        long totalEmployees = employeeRepository.findAll().stream()
                .filter(e -> e.getStatus() == Status.Active)
                .count();

        LocalDate today = attendanceHelper.getLocalTimeDetails(null, null).getDate();
        List<Attendance> todayLogs = attendanceRepository.findByAttendanceDate(today);

        long presentCount = todayLogs.size();
        long lateCount = todayLogs.stream().filter(a -> Boolean.TRUE.equals(a.getIsLate())).count();
        long earlyLeaveCount = todayLogs.stream().filter(a -> Boolean.TRUE.equals(a.getIsEarlyLeave())).count();
        long onLeaveToday = leaveRepository.findByStatus(LeaveStatus.Approved).stream()
                .filter(l -> today.equals(l.getLeaveDate()))
                .count();

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalEmployees", totalEmployees);
        stats.put("presentToday", presentCount);
        stats.put("lateToday", lateCount);
        stats.put("earlyLeaveToday", earlyLeaveCount);
        stats.put("onLeaveToday", onLeaveToday);

        return ResponseEntity.ok(stats);
    }

    @PostMapping
    @PreAuthorize("@perm.has('add_attendance')")
    public ResponseEntity<?> createAttendance(@RequestBody Attendance attendance) {
        if (attendance.getStaffId() == null || attendance.getAttendanceDate() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Staff ID and Attendance Date are required"));
        }

        Optional<Employee> empOpt = employeeRepository.findByStaffId(attendance.getStaffId());
        if (empOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Employee not found"));
        }

        Optional<Attendance> existing = attendanceRepository.findByStaffIdAndAttendanceDate(attendance.getStaffId(), attendance.getAttendanceDate());
        if (existing.isPresent()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Attendance record already exists for this date. Please edit instead."));
        }

        calculateLateAndEarlyLeave(attendance, empOpt.get());
        Attendance saved = attendanceRepository.save(attendance);

        Map<String, Employee> empMap = Map.of(empOpt.get().getStaffId(), empOpt.get());
        Map<UUID, Department> deptMap = departmentRepository.findAll().stream().collect(Collectors.toMap(Department::getId, d -> d, (a, b) -> a));
        Map<UUID, Position> posMap = positionRepository.findAll().stream().collect(Collectors.toMap(Position::getId, p -> p, (a, b) -> a));

        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "message", "Attendance record created successfully",
                "data", enrichAttendance(saved, empMap, deptMap, posMap)
        ));
    }

    @PutMapping("/{id}")
    @PreAuthorize("@perm.has('edit_attendance')")
    public ResponseEntity<?> updateAttendance(@PathVariable UUID id, @RequestBody Attendance updated) {
        Optional<Attendance> existingOpt = attendanceRepository.findById(id);
        if (existingOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Attendance record not found"));
        }

        Attendance existing = existingOpt.get();
        existing.setCheckin1(updated.getCheckin1());
        existing.setCheckout1(updated.getCheckout1());
        existing.setCheckin2(updated.getCheckin2());
        existing.setCheckout2(updated.getCheckout2());
        existing.setNote(updated.getNote());

        Optional<Employee> empOpt = employeeRepository.findByStaffId(existing.getStaffId());
        empOpt.ifPresent(employee -> calculateLateAndEarlyLeave(existing, employee));

        Attendance saved = attendanceRepository.save(existing);

        Map<String, Employee> empMap = empOpt.map(employee -> Map.of(employee.getStaffId(), employee)).orElseGet(Collections::emptyMap);
        Map<UUID, Department> deptMap = departmentRepository.findAll().stream().collect(Collectors.toMap(Department::getId, d -> d, (a, b) -> a));
        Map<UUID, Position> posMap = positionRepository.findAll().stream().collect(Collectors.toMap(Position::getId, p -> p, (a, b) -> a));

        return ResponseEntity.ok(Map.of(
                "message", "Attendance record updated successfully",
                "data", enrichAttendance(saved, empMap, deptMap, posMap)
        ));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("@perm.has('delete_attendance')")
    public ResponseEntity<?> deleteAttendance(@PathVariable UUID id) {
        if (attendanceRepository.existsById(id)) {
            attendanceRepository.deleteById(id);
            return ResponseEntity.ok(Map.of("message", "Attendance record deleted successfully"));
        }
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Attendance record not found"));
    }

    private void calculateLateAndEarlyLeave(Attendance att, Employee emp) {
        boolean isLate = false;
        boolean isEarlyLeave = false;

        String s1Start = (emp.getShift1Start() != null && !emp.getShift1Start().isBlank()) ? emp.getShift1Start() : "08:00";
        String s1End = (emp.getShift1End() != null && !emp.getShift1End().isBlank()) ? emp.getShift1End() : "12:00";
        String s2Start = (emp.getShift2Start() != null && !emp.getShift2Start().isBlank()) ? emp.getShift2Start() : "13:00";
        String s2End = (emp.getShift2End() != null && !emp.getShift2End().isBlank()) ? emp.getShift2End() : "17:00";

        int graceMinutes = 0;
        List<CompanyWorkHour> cwhList = companyWorkHourRepository.findAll();
        if (!cwhList.isEmpty() && cwhList.get(0).getLateGraceMinutes() != null) {
            graceMinutes = cwhList.get(0).getLateGraceMinutes();
        }

        int s1StartMin = attendanceHelper.timeToMinutes(s1Start) + graceMinutes;
        int s1EndMin = attendanceHelper.timeToMinutes(s1End);
        int s2StartMin = attendanceHelper.timeToMinutes(s2Start) + graceMinutes;
        int s2EndMin = attendanceHelper.timeToMinutes(s2End);

        if (att.getCheckin1() != null && !att.getCheckin1().isBlank() && attendanceHelper.timeToMinutes(att.getCheckin1()) > s1StartMin) {
            isLate = true;
        }
        if (att.getCheckin2() != null && !att.getCheckin2().isBlank() && attendanceHelper.timeToMinutes(att.getCheckin2()) > s2StartMin) {
            isLate = true;
        }
        if (att.getCheckout1() != null && !att.getCheckout1().isBlank() && attendanceHelper.timeToMinutes(att.getCheckout1()) < s1EndMin) {
            isEarlyLeave = true;
        }
        if (att.getCheckout2() != null && !att.getCheckout2().isBlank() && attendanceHelper.timeToMinutes(att.getCheckout2()) < s2EndMin) {
            isEarlyLeave = true;
        }

        att.setIsLate(isLate);
        att.setIsEarlyLeave(isEarlyLeave);
    }

    private Map<String, Object> enrichAttendance(
            Attendance a,
            Map<String, Employee> empMap,
            Map<UUID, Department> deptMap,
            Map<UUID, Position> posMap
    ) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", a.getId());
        map.put("staffId", a.getStaffId());
        map.put("attendanceDate", a.getAttendanceDate());
        map.put("checkin1", a.getCheckin1());
        map.put("checkout1", a.getCheckout1());
        map.put("checkin2", a.getCheckin2());
        map.put("checkout2", a.getCheckout2());
        map.put("isLate", a.getIsLate());
        map.put("isEarlyLeave", a.getIsEarlyLeave());
        map.put("note", a.getNote());
        map.put("createdAt", a.getCreatedAt());
        map.put("updatedAt", a.getUpdatedAt());

        Employee emp = empMap.get(a.getStaffId());
        if (emp != null) {
            Map<String, Object> empData = new HashMap<>();
            empData.put("staffId", emp.getStaffId());
            empData.put("nameEn", emp.getNameEn());
            empData.put("nameKh", emp.getNameKh());
            empData.put("gender", emp.getGender());
            empData.put("branch", emp.getBranch());
            empData.put("role", emp.getRole() != null ? emp.getRole().name() : null);
            empData.put("photoUrl", emp.getPhotoUrl());
            empData.put("shift1Start", emp.getShift1Start());
            empData.put("shift1End", emp.getShift1End());
            empData.put("shift2Start", emp.getShift2Start());
            empData.put("shift2End", emp.getShift2End());

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
