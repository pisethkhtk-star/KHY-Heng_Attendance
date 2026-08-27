package com.hrchomnan.backend.controller;

import com.hrchomnan.backend.enums.Role;
import com.hrchomnan.backend.enums.Status;
import com.hrchomnan.backend.model.Department;
import com.hrchomnan.backend.model.Employee;
import com.hrchomnan.backend.model.EmployeeFaceData;
import com.hrchomnan.backend.model.Position;
import com.hrchomnan.backend.repository.DepartmentRepository;
import com.hrchomnan.backend.repository.EmployeeFaceDataRepository;
import com.hrchomnan.backend.repository.EmployeeRepository;
import com.hrchomnan.backend.repository.PositionRepository;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/employees")
@RequiredArgsConstructor
public class EmployeeController {

    private final EmployeeRepository employeeRepository;
    private final DepartmentRepository departmentRepository;
    private final PositionRepository positionRepository;
    private final EmployeeFaceDataRepository employeeFaceDataRepository;
    private final PasswordEncoder passwordEncoder;

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getAllEmployees(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String departmentId,
            @RequestParam(required = false) String branch,
            @RequestParam(required = false) String status
    ) {
        List<Employee> list = employeeRepository.findAll();

        if (status != null && !status.isBlank()) {
            try {
                Status st = Status.valueOf(status);
                list = list.stream().filter(e -> e.getStatus() == st).collect(Collectors.toList());
            } catch (IllegalArgumentException ignored) {}
        }

        if (branch != null && !branch.isBlank()) {
            final String b = branch.trim().toLowerCase();
            list = list.stream().filter(e -> e.getBranch() != null && e.getBranch().toLowerCase().contains(b)).collect(Collectors.toList());
        }

        if (departmentId != null && !departmentId.isBlank()) {
            try {
                UUID deptUuid = UUID.fromString(departmentId);
                list = list.stream().filter(e -> deptUuid.equals(e.getDepartmentId())).collect(Collectors.toList());
            } catch (Exception ignored) {}
        }

        if (search != null && !search.isBlank()) {
            final String s = search.trim().toLowerCase();
            list = list.stream().filter(e ->
                    (e.getNameEn() != null && e.getNameEn().toLowerCase().contains(s)) ||
                    (e.getNameKh() != null && e.getNameKh().toLowerCase().contains(s)) ||
                    (e.getStaffId() != null && e.getStaffId().toLowerCase().contains(s)) ||
                    (e.getEmail() != null && e.getEmail().toLowerCase().contains(s))
            ).collect(Collectors.toList());
        }

        list.sort(Comparator.comparing(Employee::getStaffId, Comparator.nullsLast(String::compareToIgnoreCase)));

        Map<UUID, Department> deptMap = departmentRepository.findAll().stream()
                .collect(Collectors.toMap(Department::getId, d -> d, (a, b) -> a));
        Map<UUID, Position> posMap = positionRepository.findAll().stream()
                .collect(Collectors.toMap(Position::getId, p -> p, (a, b) -> a));
        Map<String, String> faceDataMap = employeeFaceDataRepository.findAll().stream()
                .filter(f -> f.getStaffId() != null && f.getPhotoUrl() != null)
                .collect(Collectors.toMap(EmployeeFaceData::getStaffId, EmployeeFaceData::getPhotoUrl, (a, b) -> a));

        List<Map<String, Object>> response = list.stream()
                .map(e -> enrichEmployee(e, deptMap, posMap, faceDataMap))
                .collect(Collectors.toList());

        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getEmployeeById(@PathVariable UUID id) {
        Optional<Employee> empOpt = employeeRepository.findById(id);
        if (empOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Employee not found"));
        }

        Map<UUID, Department> deptMap = departmentRepository.findAll().stream()
                .collect(Collectors.toMap(Department::getId, d -> d, (a, b) -> a));
        Map<UUID, Position> posMap = positionRepository.findAll().stream()
                .collect(Collectors.toMap(Position::getId, p -> p, (a, b) -> a));
        Map<String, String> faceDataMap = employeeFaceDataRepository.findAll().stream()
                .filter(f -> f.getStaffId() != null && f.getPhotoUrl() != null)
                .collect(Collectors.toMap(EmployeeFaceData::getStaffId, EmployeeFaceData::getPhotoUrl, (a, b) -> a));

        return ResponseEntity.ok(enrichEmployee(empOpt.get(), deptMap, posMap, faceDataMap));
    }

    @GetMapping("/staff/{staffId}")
    public ResponseEntity<?> getEmployeeByStaffId(@PathVariable String staffId) {
        Optional<Employee> empOpt = employeeRepository.findByStaffId(staffId);
        if (empOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Employee not found"));
        }

        Map<UUID, Department> deptMap = departmentRepository.findAll().stream()
                .collect(Collectors.toMap(Department::getId, d -> d, (a, b) -> a));
        Map<UUID, Position> posMap = positionRepository.findAll().stream()
                .collect(Collectors.toMap(Position::getId, p -> p, (a, b) -> a));
        Map<String, String> faceDataMap = employeeFaceDataRepository.findAll().stream()
                .filter(f -> f.getStaffId() != null && f.getPhotoUrl() != null)
                .collect(Collectors.toMap(EmployeeFaceData::getStaffId, EmployeeFaceData::getPhotoUrl, (a, b) -> a));

        return ResponseEntity.ok(enrichEmployee(empOpt.get(), deptMap, posMap, faceDataMap));
    }

    @Data
    public static class EmployeeCreateDto {
        private String staffId;
        private String nameEn;
        private String nameKh;
        private String gender;
        private UUID positionId;
        private UUID departmentId;
        private String branch;
        private String joinDate;
        private String status;
        private String shift1Start;
        private String shift1End;
        private String shift2Start;
        private String shift2End;
        private String address;
        private String idCardPassport;
        private String email;
        private String password;
        private String role;
        private String facePhoto;
        private String faceDescriptor;
        private String profilePhoto;
        private Boolean isFlexible;
        private String flexibleSchedule;
    }

    @PostMapping
    public ResponseEntity<?> createEmployee(@RequestBody EmployeeCreateDto dto) {
        if (dto.getStaffId() == null || dto.getNameEn() == null || dto.getNameKh() == null ||
                dto.getEmail() == null || dto.getPassword() == null || dto.getPositionId() == null || dto.getDepartmentId() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Required fields are missing"));
        }

        if (employeeRepository.findByStaffId(dto.getStaffId()).isPresent()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Staff ID already exists"));
        }

        if (employeeRepository.findByEmail(dto.getEmail()).isPresent()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Email already registered"));
        }

        Role role = Role.Employee;
        if (dto.getRole() != null) {
            try {
                role = Role.valueOf(dto.getRole());
            } catch (Exception ignored) {}
        }

        Status status = Status.Active;
        if (dto.getStatus() != null) {
            try {
                status = Status.valueOf(dto.getStatus());
            } catch (Exception ignored) {}
        }

        LocalDate join = dto.getJoinDate() != null ? LocalDate.parse(dto.getJoinDate()) : LocalDate.now();

        Employee emp = Employee.builder()
                .staffId(dto.getStaffId())
                .nameEn(dto.getNameEn())
                .nameKh(dto.getNameKh())
                .gender(dto.getGender() != null ? dto.getGender() : "Male")
                .positionId(dto.getPositionId())
                .departmentId(dto.getDepartmentId())
                .branch(dto.getBranch() != null ? dto.getBranch() : "")
                .joinDate(join)
                .status(status)
                .shift1Start(dto.getShift1Start() != null ? dto.getShift1Start() : "08:00")
                .shift1End(dto.getShift1End() != null ? dto.getShift1End() : "12:00")
                .shift2Start(dto.getShift2Start() != null ? dto.getShift2Start() : "13:00")
                .shift2End(dto.getShift2End() != null ? dto.getShift2End() : "17:00")
                .isFlexible(dto.getIsFlexible() != null ? dto.getIsFlexible() : false)
                .flexibleSchedule(dto.getFlexibleSchedule() != null ? dto.getFlexibleSchedule() : "{}")
                .address(dto.getAddress() != null ? dto.getAddress() : "")
                .idCardPassport(dto.getIdCardPassport() != null ? dto.getIdCardPassport() : "")
                .email(dto.getEmail())
                .password(passwordEncoder.encode(dto.getPassword()))
                .role(role)
                .photoUrl(dto.getProfilePhoto())
                .build();

        Employee saved = employeeRepository.save(emp);

        if (dto.getFaceDescriptor() != null && dto.getFacePhoto() != null) {
            employeeFaceDataRepository.findByStaffId(saved.getStaffId()).ifPresent(employeeFaceDataRepository::delete);
            employeeFaceDataRepository.save(EmployeeFaceData.builder()
                    .staffId(saved.getStaffId())
                    .faceDescriptor(dto.getFaceDescriptor())
                    .photoUrl(dto.getFacePhoto())
                    .build());
        }

        Map<UUID, Department> deptMap = departmentRepository.findAll().stream()
                .collect(Collectors.toMap(Department::getId, d -> d, (a, b) -> a));
        Map<UUID, Position> posMap = positionRepository.findAll().stream()
                .collect(Collectors.toMap(Position::getId, p -> p, (a, b) -> a));
        Map<String, String> faceDataMap = employeeFaceDataRepository.findAll().stream()
                .filter(f -> f.getStaffId() != null && f.getPhotoUrl() != null)
                .collect(Collectors.toMap(EmployeeFaceData::getStaffId, EmployeeFaceData::getPhotoUrl, (a, b) -> a));

        return ResponseEntity.status(HttpStatus.CREATED).body(enrichEmployee(saved, deptMap, posMap, faceDataMap));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateEmployee(@PathVariable UUID id, @RequestBody EmployeeCreateDto dto) {
        Optional<Employee> empOpt = employeeRepository.findById(id);
        if (empOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Employee not found"));
        }

        Employee emp = empOpt.get();

        if (dto.getStaffId() != null && !dto.getStaffId().equalsIgnoreCase(emp.getStaffId())) {
            if (employeeRepository.findByStaffId(dto.getStaffId()).isPresent()) {
                return ResponseEntity.badRequest().body(Map.of("message", "Staff ID already in use"));
            }
            emp.setStaffId(dto.getStaffId());
        }

        if (dto.getEmail() != null && !dto.getEmail().equalsIgnoreCase(emp.getEmail())) {
            if (employeeRepository.findByEmail(dto.getEmail()).isPresent()) {
                return ResponseEntity.badRequest().body(Map.of("message", "Email already in use"));
            }
            emp.setEmail(dto.getEmail());
        }

        if (dto.getNameEn() != null) emp.setNameEn(dto.getNameEn());
        if (dto.getNameKh() != null) emp.setNameKh(dto.getNameKh());
        if (dto.getGender() != null) emp.setGender(dto.getGender());
        if (dto.getPositionId() != null) emp.setPositionId(dto.getPositionId());
        if (dto.getDepartmentId() != null) emp.setDepartmentId(dto.getDepartmentId());
        if (dto.getBranch() != null) emp.setBranch(dto.getBranch());
        if (dto.getAddress() != null) emp.setAddress(dto.getAddress());
        if (dto.getIdCardPassport() != null) emp.setIdCardPassport(dto.getIdCardPassport());
        if (dto.getProfilePhoto() != null) emp.setPhotoUrl(dto.getProfilePhoto());
        if (dto.getShift1Start() != null) emp.setShift1Start(dto.getShift1Start());
        if (dto.getShift1End() != null) emp.setShift1End(dto.getShift1End());
        if (dto.getShift2Start() != null) emp.setShift2Start(dto.getShift2Start());
        if (dto.getShift2End() != null) emp.setShift2End(dto.getShift2End());
        if (dto.getIsFlexible() != null) emp.setIsFlexible(dto.getIsFlexible());
        if (dto.getFlexibleSchedule() != null) emp.setFlexibleSchedule(dto.getFlexibleSchedule());

        if (dto.getJoinDate() != null) {
            emp.setJoinDate(LocalDate.parse(dto.getJoinDate()));
        }

        if (dto.getStatus() != null) {
            try {
                emp.setStatus(Status.valueOf(dto.getStatus()));
            } catch (Exception ignored) {}
        }

        if (dto.getRole() != null) {
            try {
                emp.setRole(Role.valueOf(dto.getRole()));
            } catch (Exception ignored) {}
        }

        if (dto.getPassword() != null && !dto.getPassword().isBlank()) {
            emp.setPassword(passwordEncoder.encode(dto.getPassword()));
        }

        Employee saved = employeeRepository.save(emp);

        if (dto.getFaceDescriptor() != null && dto.getFacePhoto() != null) {
            employeeFaceDataRepository.findByStaffId(saved.getStaffId()).ifPresent(employeeFaceDataRepository::delete);
            employeeFaceDataRepository.save(EmployeeFaceData.builder()
                    .staffId(saved.getStaffId())
                    .faceDescriptor(dto.getFaceDescriptor())
                    .photoUrl(dto.getFacePhoto())
                    .build());
        }

        Map<UUID, Department> deptMap = departmentRepository.findAll().stream()
                .collect(Collectors.toMap(Department::getId, d -> d, (a, b) -> a));
        Map<UUID, Position> posMap = positionRepository.findAll().stream()
                .collect(Collectors.toMap(Position::getId, p -> p, (a, b) -> a));
        Map<String, String> faceDataMap = employeeFaceDataRepository.findAll().stream()
                .filter(f -> f.getStaffId() != null && f.getPhotoUrl() != null)
                .collect(Collectors.toMap(EmployeeFaceData::getStaffId, EmployeeFaceData::getPhotoUrl, (a, b) -> a));

        return ResponseEntity.ok(enrichEmployee(saved, deptMap, posMap, faceDataMap));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteEmployee(@PathVariable UUID id) {
        if (employeeRepository.existsById(id)) {
            employeeRepository.deleteById(id);
            return ResponseEntity.ok(Map.of("message", "Employee deleted successfully"));
        }
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Employee not found"));
    }

    private Map<String, Object> enrichEmployee(
            Employee e,
            Map<UUID, Department> deptMap,
            Map<UUID, Position> posMap,
            Map<String, String> faceDataMap
    ) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", e.getId());
        map.put("staffId", e.getStaffId());
        map.put("nameEn", e.getNameEn());
        map.put("nameKh", e.getNameKh());
        map.put("gender", e.getGender());
        map.put("departmentId", e.getDepartmentId());
        map.put("positionId", e.getPositionId());
        map.put("branch", e.getBranch());
        map.put("joinDate", e.getJoinDate());
        map.put("status", e.getStatus());
        map.put("shift1Start", e.getShift1Start());
        map.put("shift1End", e.getShift1End());
        map.put("shift2Start", e.getShift2Start());
        map.put("shift2End", e.getShift2End());
        map.put("isFlexible", e.getIsFlexible() != null ? e.getIsFlexible() : false);
        map.put("flexibleSchedule", e.getFlexibleSchedule() != null ? e.getFlexibleSchedule() : "{}");
        map.put("address", e.getAddress());
        map.put("idCardPassport", e.getIdCardPassport());
        map.put("photoUrl", e.getPhotoUrl());
        map.put("email", e.getEmail());
        map.put("role", e.getRole());
        map.put("createdAt", e.getCreatedAt());
        map.put("updatedAt", e.getUpdatedAt());

        Department d = e.getDepartmentId() != null ? deptMap.get(e.getDepartmentId()) : null;
        if (d != null) {
            map.put("department", Map.of("nameEn", d.getNameEn(), "nameKh", d.getNameKh()));
        } else {
            map.put("department", null);
        }

        Position p = e.getPositionId() != null ? posMap.get(e.getPositionId()) : null;
        if (p != null) {
            map.put("position", Map.of("titleEn", p.getTitleEn(), "titleKh", p.getTitleKh()));
        } else {
            map.put("position", null);
        }

        String facePhoto = faceDataMap.get(e.getStaffId());
        if (facePhoto != null) {
            map.put("faceData", Map.of("photoUrl", facePhoto));
        } else {
            map.put("faceData", null);
        }

        return map;
    }
}
