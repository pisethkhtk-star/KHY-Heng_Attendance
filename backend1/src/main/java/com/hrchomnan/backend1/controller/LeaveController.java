package com.hrchomnan.backend1.controller;

import com.hrchomnan.backend1.enums.LeaveStatus;
import com.hrchomnan.backend1.model.Attendance;
import com.hrchomnan.backend1.model.Leave;
import com.hrchomnan.backend1.repository.AttendanceRepository;
import com.hrchomnan.backend1.repository.EmployeeRepository;
import com.hrchomnan.backend1.repository.LeaveRepository;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/leaves")
@RequiredArgsConstructor
public class LeaveController {

    private final LeaveRepository leaveRepository;
    private final EmployeeRepository employeeRepository;
    private final AttendanceRepository attendanceRepository;

    @GetMapping
    public ResponseEntity<List<Leave>> getAllLeaves(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String staffId
    ) {
        if (staffId != null) {
            return ResponseEntity.ok(leaveRepository.findByStaffId(staffId));
        }
        if (status != null) {
            try {
                LeaveStatus leaveStatus = LeaveStatus.valueOf(status);
                return ResponseEntity.ok(leaveRepository.findByStatus(leaveStatus));
            } catch (IllegalArgumentException ignored) {}
        }
        return ResponseEntity.ok(leaveRepository.findAll());
    }

    @GetMapping("/employee/{staffId}")
    public ResponseEntity<List<Leave>> getByEmployee(@PathVariable String staffId) {
        return ResponseEntity.ok(leaveRepository.findByStaffId(staffId));
    }

    @Data
    public static class CreateLeaveRequest {
        private String staffId;
        private String leaveDate;
        private String startDate;
        private String endDate;
        private String durationType = "Full Day";
        private String leaveType;
        private Double amountDays;
        private String reason;
    }

    @PostMapping
    public ResponseEntity<?> createLeave(@RequestBody CreateLeaveRequest request) {
        if (request.getStaffId() == null || request.getLeaveType() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Required fields are missing"));
        }

        String startStr = request.getStartDate() != null ? request.getStartDate() : request.getLeaveDate();
        String endStr = request.getEndDate() != null ? request.getEndDate() : request.getLeaveDate();

        if (startStr == null || endStr == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Required fields are missing"));
        }

        LocalDate start = LocalDate.parse(startStr);
        LocalDate end = LocalDate.parse(endStr);

        List<Leave> createdLeaves = new ArrayList<>();
        LocalDate current = start;

        BigDecimal amount = BigDecimal.ONE;
        if ("Morning".equals(request.getDurationType()) || "Afternoon".equals(request.getDurationType())) {
            amount = new BigDecimal("0.5");
        } else if (request.getAmountDays() != null) {
            amount = BigDecimal.valueOf(request.getAmountDays());
        }

        while (!current.isAfter(end)) {
            Leave leave = Leave.builder()
                    .staffId(request.getStaffId())
                    .leaveDate(current)
                    .leaveType(request.getLeaveType())
                    .amountDays(amount)
                    .reason(request.getReason())
                    .status(LeaveStatus.Pending)
                    .requestedAt(LocalDateTime.now())
                    .build();

            createdLeaves.add(leaveRepository.save(leave));
            current = current.plusDays(1);
        }

        return ResponseEntity.status(HttpStatus.CREATED).body(createdLeaves.get(0));
    }

    @Data
    public static class StatusUpdateRequest {
        private String status; // Approved, Rejected
        private String managerName;
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<?> updateStatus(@PathVariable UUID id, @RequestBody StatusUpdateRequest request) {
        if (request.getStatus() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Status is required"));
        }

        LeaveStatus newStatus;
        try {
            newStatus = LeaveStatus.valueOf(request.getStatus());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", "Valid status (Approved or Rejected) is required"));
        }

        Optional<Leave> leaveOpt = leaveRepository.findById(id);
        if (leaveOpt.isPresent()) {
            Leave leave = leaveOpt.get();
            leave.setStatus(newStatus);
            leave.setManagerName(request.getManagerName() != null ? request.getManagerName() : "System Admin");
            leave.setApprovedAt(LocalDateTime.now());
            Leave updated = leaveRepository.save(leave);

            if (newStatus == LeaveStatus.Approved) {
                attendanceRepository.findByStaffIdAndAttendanceDate(leave.getStaffId(), leave.getLeaveDate())
                        .orElseGet(() -> attendanceRepository.save(Attendance.builder()
                                .staffId(leave.getStaffId())
                                .attendanceDate(leave.getLeaveDate())
                                .note("Approved Leave: " + leave.getLeaveType())
                                .build()));
            }

            return ResponseEntity.ok(updated);
        }
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Leave request not found"));
    }
}
