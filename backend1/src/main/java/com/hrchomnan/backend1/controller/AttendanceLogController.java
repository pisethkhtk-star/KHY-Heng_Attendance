package com.hrchomnan.backend1.controller;

import com.hrchomnan.backend1.model.AttendanceLog;
import com.hrchomnan.backend1.repository.AttendanceLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/attendance-logs")
@RequiredArgsConstructor
public class AttendanceLogController {

    private final AttendanceLogRepository attendanceLogRepository;

    @GetMapping
    public ResponseEntity<List<AttendanceLog>> getAllLogs(@RequestParam(required = false) String staffId) {
        if (staffId != null) {
            return ResponseEntity.ok(attendanceLogRepository.findByStaffId(staffId));
        }
        return ResponseEntity.ok(attendanceLogRepository.findAll());
    }

    @PostMapping
    public ResponseEntity<AttendanceLog> createLog(@RequestBody AttendanceLog log) {
        return ResponseEntity.ok(attendanceLogRepository.save(log));
    }
}
