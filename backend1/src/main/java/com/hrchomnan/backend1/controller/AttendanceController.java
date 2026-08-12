package com.hrchomnan.backend1.controller;

import com.hrchomnan.backend1.enums.LeaveStatus;
import com.hrchomnan.backend1.model.Attendance;
import com.hrchomnan.backend1.model.Employee;
import com.hrchomnan.backend1.repository.AttendanceRepository;
import com.hrchomnan.backend1.repository.EmployeeRepository;
import com.hrchomnan.backend1.repository.LeaveRepository;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/attendances")
@RequiredArgsConstructor
public class AttendanceController {

    private final AttendanceRepository attendanceRepository;
    private final EmployeeRepository employeeRepository;
    private final LeaveRepository leaveRepository;

    @Data
    public static class LogRequest {
        private String staffId;
        private String action; // checkin_1, checkout_1, checkin_2, checkout_2
        private String customTime;
        private String customDate;
        private String note;
    }

    @PostMapping("/log")
    public ResponseEntity<?> logCheckInOut(@RequestBody LogRequest request) {
        if (request.getStaffId() == null || request.getAction() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Staff ID and Action are required"));
        }

        Optional<Employee> empOpt = employeeRepository.findByStaffId(request.getStaffId());
        if (empOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Employee not found"));
        }

        Employee employee = empOpt.get();
        LocalDate attendanceDate = request.getCustomDate() != null ? LocalDate.parse(request.getCustomDate()) : LocalDate.now();
        String timeString = request.getCustomTime() != null ? request.getCustomTime() : LocalTime.now().format(DateTimeFormatter.ofPattern("HH:mm"));

        Optional<Attendance> existingOpt = attendanceRepository.findByStaffIdAndAttendanceDate(employee.getStaffId(), attendanceDate);
        Attendance attendance = existingOpt.orElseGet(() -> Attendance.builder()
                .staffId(employee.getStaffId())
                .attendanceDate(attendanceDate)
                .build());

        if (request.getNote() != null) {
            attendance.setNote(request.getNote());
        }

        switch (request.getAction()) {
            case "checkin_1" -> attendance.setCheckin1(timeString);
            case "checkout_1" -> attendance.setCheckout1(timeString);
            case "checkin_2" -> attendance.setCheckin2(timeString);
            case "checkout_2" -> attendance.setCheckout2(timeString);
            default -> {
                return ResponseEntity.badRequest().body(Map.of("message", "Invalid action"));
            }
        }

        // Calculate late & early leave
        boolean isLate = false;
        boolean isEarlyLeave = false;

        if (attendance.getCheckin1() != null && attendance.getCheckin1().compareTo(employee.getShift1Start()) > 0) {
            isLate = true;
        }
        if (attendance.getCheckin2() != null && attendance.getCheckin2().compareTo(employee.getShift2Start()) > 0) {
            isLate = true;
        }
        if (attendance.getCheckout1() != null && attendance.getCheckout1().compareTo(employee.getShift1End()) < 0) {
            isEarlyLeave = true;
        }
        if (attendance.getCheckout2() != null && attendance.getCheckout2().compareTo(employee.getShift2End()) < 0) {
            isEarlyLeave = true;
        }

        attendance.setIsLate(isLate);
        attendance.setIsEarlyLeave(isEarlyLeave);

        Attendance saved = attendanceRepository.save(attendance);
        return ResponseEntity.ok(Map.of(
                "message", "Successfully logged " + request.getAction() + " at " + timeString,
                "data", saved
        ));
    }

    @GetMapping("/today")
    public ResponseEntity<List<Attendance>> getTodayAttendance() {
        return ResponseEntity.ok(attendanceRepository.findByAttendanceDate(LocalDate.now()));
    }

    @GetMapping("/history")
    public ResponseEntity<List<Attendance>> getHistory(
            @RequestParam(required = false) String staffId,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate
    ) {
        if (staffId != null) {
            return ResponseEntity.ok(attendanceRepository.findByStaffId(staffId));
        }
        if (startDate != null && endDate != null) {
            return ResponseEntity.ok(attendanceRepository.findByAttendanceDateBetween(
                    LocalDate.parse(startDate), LocalDate.parse(endDate)
            ));
        }
        return ResponseEntity.ok(attendanceRepository.findAll());
    }

    @GetMapping("/stats-summary")
    public ResponseEntity<Map<String, Object>> getStatsSummary() {
        long totalEmployees = employeeRepository.count();
        List<Attendance> todayLogs = attendanceRepository.findByAttendanceDate(LocalDate.now());

        long presentCount = todayLogs.size();
        long lateCount = todayLogs.stream().filter(Attendance::getIsLate).count();
        long earlyLeaveCount = todayLogs.stream().filter(Attendance::getIsEarlyLeave).count();
        long onLeaveToday = leaveRepository.findByStatus(LeaveStatus.Approved).stream()
                .filter(l -> l.getLeaveDate().equals(LocalDate.now()))
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
    public ResponseEntity<?> createAttendance(@RequestBody Attendance attendance) {
        if (attendance.getStaffId() == null || attendance.getAttendanceDate() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Staff ID and Attendance Date are required"));
        }
        Attendance saved = attendanceRepository.save(attendance);
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("message", "Attendance record created successfully", "data", saved));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateAttendance(@PathVariable UUID id, @RequestBody Attendance updated) {
        return attendanceRepository.findById(id)
                .map(existing -> {
                    existing.setCheckin1(updated.getCheckin1());
                    existing.setCheckout1(updated.getCheckout1());
                    existing.setCheckin2(updated.getCheckin2());
                    existing.setCheckout2(updated.getCheckout2());
                    existing.setNote(updated.getNote());
                    Attendance saved = attendanceRepository.save(existing);
                    return ResponseEntity.ok(Map.of("message", "Attendance record updated successfully", "data", saved));
                })
                .orElse(ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Attendance record not found")));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteAttendance(@PathVariable UUID id) {
        if (attendanceRepository.existsById(id)) {
            attendanceRepository.deleteById(id);
            return ResponseEntity.ok(Map.of("message", "Attendance record deleted successfully"));
        }
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Attendance record not found"));
    }
}
