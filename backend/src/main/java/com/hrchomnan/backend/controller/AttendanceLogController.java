package com.hrchomnan.backend.controller;

import com.hrchomnan.backend.model.AttendanceLog;
import com.hrchomnan.backend.model.Department;
import com.hrchomnan.backend.model.Employee;
import com.hrchomnan.backend.repository.AttendanceLogRepository;
import com.hrchomnan.backend.repository.DepartmentRepository;
import com.hrchomnan.backend.repository.EmployeeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/attendance-logs")
@RequiredArgsConstructor
public class AttendanceLogController {

    private final AttendanceLogRepository attendanceLogRepository;
    private final EmployeeRepository employeeRepository;
    private final DepartmentRepository departmentRepository;

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getAllLogs(
            @RequestParam(required = false) String staffId,
            @RequestParam(required = false) String method,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate
    ) {
        List<AttendanceLog> list = attendanceLogRepository.findAll();

        if (staffId != null && !staffId.isBlank()) {
            final String s = staffId.trim().toLowerCase();
            list = list.stream().filter(l -> l.getStaffId() != null && l.getStaffId().toLowerCase().contains(s)).collect(Collectors.toList());
        }

        if (method != null && !method.isBlank()) {
            final String m = method.trim().toLowerCase();
            list = list.stream().filter(l -> l.getMethod() != null && l.getMethod().equalsIgnoreCase(m)).collect(Collectors.toList());
        }

        if (startDate != null && !startDate.isBlank()) {
            LocalDateTime startLdt = LocalDate.parse(startDate).atStartOfDay();
            list = list.stream().filter(l -> l.getCreatedAt() != null && !l.getCreatedAt().isBefore(startLdt)).collect(Collectors.toList());
        }

        if (endDate != null && !endDate.isBlank()) {
            LocalDateTime endLdt = LocalDate.parse(endDate).atTime(LocalTime.MAX);
            list = list.stream().filter(l -> l.getCreatedAt() != null && !l.getCreatedAt().isAfter(endLdt)).collect(Collectors.toList());
        }

        list.sort(Comparator.comparing(AttendanceLog::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())));

        Map<String, Employee> empMap = employeeRepository.findAll().stream()
                .collect(Collectors.toMap(Employee::getStaffId, e -> e, (a, b) -> a));
        Map<UUID, Department> deptMap = departmentRepository.findAll().stream()
                .collect(Collectors.toMap(Department::getId, d -> d, (a, b) -> a));

        List<Map<String, Object>> response = list.stream().map(log -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", log.getId());
            map.put("staffId", log.getStaffId());
            map.put("method", log.getMethod());
            map.put("action", log.getAction());
            map.put("capturedAt", log.getCapturedAt());
            map.put("deviceInfo", log.getDeviceInfo());
            map.put("location", log.getLocation());
            map.put("photoSnapshotUrl", log.getPhotoSnapshotUrl());
            map.put("status", log.getStatus());
            map.put("createdAt", log.getCreatedAt());

            Employee emp = (log.getStaffId() != null) ? empMap.get(log.getStaffId()) : null;
            if (emp != null) {
                Map<String, Object> empData = new HashMap<>();
                empData.put("nameEn", emp.getNameEn());
                empData.put("nameKh", emp.getNameKh());
                empData.put("branch", emp.getBranch());

                Department d = emp.getDepartmentId() != null ? deptMap.get(emp.getDepartmentId()) : null;
                if (d != null) {
                    empData.put("department", Map.of("nameEn", d.getNameEn(), "nameKh", d.getNameKh()));
                } else {
                    empData.put("department", null);
                }
                map.put("employee", empData);
            } else {
                map.put("employee", null);
            }
            return map;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(response);
    }

    @PostMapping
    public ResponseEntity<AttendanceLog> createLog(@RequestBody AttendanceLog log) {
        return ResponseEntity.ok(attendanceLogRepository.save(log));
    }
}
