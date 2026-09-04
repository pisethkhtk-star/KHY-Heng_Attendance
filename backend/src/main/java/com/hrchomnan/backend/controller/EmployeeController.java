package com.hrchomnan.backend.controller;

import com.hrchomnan.backend.enums.Role;
import com.hrchomnan.backend.enums.Status;
import com.hrchomnan.backend.model.Department;
import com.hrchomnan.backend.model.Employee;
import com.hrchomnan.backend.model.EmployeeFaceData;
import com.hrchomnan.backend.model.Position;
import com.hrchomnan.backend.repository.*;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import com.hrchomnan.backend.security.SecurityPermissionService;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/employees")
@Transactional
@RequiredArgsConstructor
public class EmployeeController {

    private final EmployeeRepository employeeRepository;
    private final DepartmentRepository departmentRepository;
    private final PositionRepository positionRepository;
    private final EmployeeFaceDataRepository employeeFaceDataRepository;
    private final AttendanceRepository attendanceRepository;
    private final AttendanceLogRepository attendanceLogRepository;
    private final LeaveRepository leaveRepository;
    private final OvertimeRepository overtimeRepository;
    private final EmployeeLeaveLimitRepository employeeLeaveLimitRepository;
    private final EmployeeQRCodeRepository employeeQRCodeRepository;
    private final LeaveApprovalRuleRepository leaveApprovalRuleRepository;
    private final PasswordEncoder passwordEncoder;
    private final SecurityPermissionService securityPermissionService;

    @GetMapping
    @PreAuthorize("@perm.has('employees')")
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
    @PreAuthorize("@perm.has('employees')")
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
    @PreAuthorize("@perm.has('employees') or @perm.isSelfOrAdmin(#staffId)")
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
        private String departmentName;
        private String positionTitle;
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
    @PreAuthorize("@perm.has('add_employee')")
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

        Role role = parseRole(dto.getRole());

        Status status = parseStatus(dto.getStatus());

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

    @PostMapping("/batch")
    @PreAuthorize("@perm.has('add_employee')")
    public ResponseEntity<?> batchCreateEmployees(@RequestBody List<EmployeeCreateDto> dtoList) {
        if (dtoList == null || dtoList.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Employee list is empty"));
        }

        List<Department> allDepts = new ArrayList<>(departmentRepository.findAll());
        List<Position> allPositions = new ArrayList<>(positionRepository.findAll());

        int insertedCount = 0;
        int skippedCount = 0;
        List<String> errors = new ArrayList<>();

        for (int i = 0; i < dtoList.size(); i++) {
            EmployeeCreateDto dto = dtoList.get(i);
            String staffId = dto.getStaffId() != null ? dto.getStaffId().trim() : "";
            String nameEn = dto.getNameEn() != null ? dto.getNameEn().trim() : "";
            String nameKh = dto.getNameKh() != null && !dto.getNameKh().isBlank() ? dto.getNameKh().trim() : nameEn;
            String email = dto.getEmail() != null ? dto.getEmail().trim() : "";

            if (staffId.isEmpty() || nameEn.isEmpty() || email.isEmpty()) {
                skippedCount++;
                errors.add("Row " + (i + 1) + ": Missing required fields (Staff ID, Name EN, or Email)");
                continue;
            }

            if (employeeRepository.findByStaffId(staffId).isPresent()) {
                skippedCount++;
                errors.add("Row " + (i + 1) + " (" + staffId + "): Staff ID already exists");
                continue;
            }

            if (employeeRepository.findByEmail(email).isPresent()) {
                skippedCount++;
                errors.add("Row " + (i + 1) + " (" + email + "): Email already exists");
                continue;
            }

            // Resolve department
            UUID deptId = dto.getDepartmentId();
            if (deptId == null && dto.getDepartmentName() != null && !dto.getDepartmentName().isBlank()) {
                final String dName = dto.getDepartmentName().trim().toLowerCase();
                Department matchedDept = allDepts.stream()
                        .filter(d -> (d.getNameEn() != null && d.getNameEn().equalsIgnoreCase(dName)) ||
                                     (d.getNameKh() != null && d.getNameKh().equalsIgnoreCase(dName)))
                        .findFirst()
                        .orElse(null);
                if (matchedDept == null) {
                    matchedDept = departmentRepository.save(Department.builder()
                            .nameEn(dto.getDepartmentName().trim())
                            .nameKh(dto.getDepartmentName().trim())
                            .description("Imported from Excel")
                            .build());
                    allDepts.add(matchedDept);
                }
                deptId = matchedDept.getId();
            }
            if (deptId == null && !allDepts.isEmpty()) {
                deptId = allDepts.get(0).getId();
            }

            // Resolve position
            UUID posId = dto.getPositionId();
            if (posId == null && dto.getPositionTitle() != null && !dto.getPositionTitle().isBlank()) {
                final String pTitle = dto.getPositionTitle().trim().toLowerCase();
                Position matchedPos = allPositions.stream()
                        .filter(p -> (p.getTitleEn() != null && p.getTitleEn().equalsIgnoreCase(pTitle)) ||
                                     (p.getTitleKh() != null && p.getTitleKh().equalsIgnoreCase(pTitle)))
                        .findFirst()
                        .orElse(null);
                if (matchedPos == null) {
                    matchedPos = positionRepository.save(Position.builder()
                            .titleEn(dto.getPositionTitle().trim())
                            .titleKh(dto.getPositionTitle().trim())
                            .departmentId(deptId)
                            .build());
                    allPositions.add(matchedPos);
                }
                posId = matchedPos.getId();
            }
            if (posId == null && !allPositions.isEmpty()) {
                posId = allPositions.get(0).getId();
            }

            Role role = parseRole(dto.getRole());
            Status status = parseStatus(dto.getStatus());
            LocalDate join = LocalDate.now();
            if (dto.getJoinDate() != null && !dto.getJoinDate().isBlank()) {
                try {
                    join = LocalDate.parse(dto.getJoinDate().trim());
                } catch (Exception ignored) {
                    try {
                        String[] parts = dto.getJoinDate().trim().split("[-/]");
                        if (parts.length == 3) {
                            if (parts[0].length() == 4) {
                                join = LocalDate.of(Integer.parseInt(parts[0]), Integer.parseInt(parts[1]), Integer.parseInt(parts[2]));
                            } else if (parts[2].length() == 4) {
                                join = LocalDate.of(Integer.parseInt(parts[2]), Integer.parseInt(parts[1]), Integer.parseInt(parts[0]));
                            }
                        }
                    } catch (Exception ex) {}
                }
            }

            String rawPass = (dto.getPassword() != null && !dto.getPassword().isBlank()) ? dto.getPassword().trim() : "12345678";

            Employee emp = Employee.builder()
                    .staffId(staffId)
                    .nameEn(nameEn)
                    .nameKh(nameKh)
                    .gender(dto.getGender() != null && !dto.getGender().isBlank() ? dto.getGender() : "Male")
                    .positionId(posId)
                    .departmentId(deptId)
                    .branch(dto.getBranch() != null ? dto.getBranch() : "")
                    .joinDate(join)
                    .status(status)
                    .shift1Start(dto.getShift1Start() != null && !dto.getShift1Start().isBlank() ? dto.getShift1Start() : "08:00")
                    .shift1End(dto.getShift1End() != null && !dto.getShift1End().isBlank() ? dto.getShift1End() : "12:00")
                    .shift2Start(dto.getShift2Start() != null ? dto.getShift2Start() : "13:00")
                    .shift2End(dto.getShift2End() != null ? dto.getShift2End() : "17:00")
                    .isFlexible(dto.getIsFlexible() != null ? dto.getIsFlexible() : false)
                    .flexibleSchedule(dto.getFlexibleSchedule() != null ? dto.getFlexibleSchedule() : "{}")
                    .address(dto.getAddress() != null ? dto.getAddress() : "")
                    .idCardPassport(dto.getIdCardPassport() != null ? dto.getIdCardPassport() : "")
                    .email(email)
                    .password(passwordEncoder.encode(rawPass))
                    .role(role)
                    .photoUrl(dto.getProfilePhoto())
                    .build();

            employeeRepository.save(emp);
            insertedCount++;
        }

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Successfully inserted " + insertedCount + " employee(s)",
                "insertedCount", insertedCount,
                "skippedCount", skippedCount,
                "errors", errors
        ));
    }

    @PutMapping("/{id}")
    @PreAuthorize("@perm.canEditEmployee(#id)")
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

        if (dto.getStatus() != null && !dto.getStatus().isBlank()) {
            emp.setStatus(parseStatus(dto.getStatus()));
        }

        if (dto.getRole() != null && !dto.getRole().isBlank()) {
            emp.setRole(parseRole(dto.getRole()));
        }

        if (dto.getPassword() != null && !dto.getPassword().isBlank()) {
            if (!securityPermissionService.canEditPassword(id)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("message", "You do not have permission to edit this employee's password"));
            }
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
    @PreAuthorize("@perm.has('delete_employee')")
    public ResponseEntity<?> deleteEmployee(@PathVariable UUID id) {
        Optional<Employee> empOpt = employeeRepository.findById(id);
        if (empOpt.isPresent()) {
            Employee emp = empOpt.get();
            String staffId = emp.getStaffId();
            if (staffId != null && !staffId.isBlank()) {
                attendanceRepository.deleteByStaffId(staffId);
                attendanceLogRepository.deleteByStaffId(staffId);
                leaveRepository.deleteByStaffId(staffId);
                overtimeRepository.deleteByStaffId(staffId);
                overtimeRepository.clearManagerReferences(staffId);
                employeeLeaveLimitRepository.deleteByStaffId(staffId);
                employeeFaceDataRepository.deleteByStaffId(staffId);
                employeeQRCodeRepository.deleteByStaffId(staffId);
                leaveApprovalRuleRepository.deleteByApproverId(staffId);
                leaveApprovalRuleRepository.deleteByTargetStaffId(staffId);
            }
            employeeRepository.delete(emp);
            return ResponseEntity.ok(Map.of("message", "Employee and all related attendance, leave, overtime, and biometric records deleted successfully"));
        }
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Employee not found"));
    }

    private Role parseRole(String roleStr) {
        if (roleStr == null || roleStr.isBlank()) return Role.Employee;
        for (Role r : Role.values()) {
            if (r.name().equalsIgnoreCase(roleStr.trim())) {
                return r;
            }
        }
        return Role.Employee;
    }

    private Status parseStatus(String statusStr) {
        if (statusStr == null || statusStr.isBlank()) return Status.Active;
        for (Status s : Status.values()) {
            if (s.name().equalsIgnoreCase(statusStr.trim())) {
                return s;
            }
        }
        return Status.Active;
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
        String facePhoto = faceDataMap.get(e.getStaffId());
        String effectivePhoto = (e.getPhotoUrl() != null && !e.getPhotoUrl().isBlank()) ? e.getPhotoUrl() : facePhoto;
        map.put("photoUrl", effectivePhoto);
        map.put("hasFaceData", faceDataMap.containsKey(e.getStaffId()));
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

        if (facePhoto != null) {
            map.put("faceData", Map.of("photoUrl", facePhoto));
        } else {
            map.put("faceData", null);
        }

        return map;
    }

    @PostMapping("/seed-12")
    public ResponseEntity<?> seed12Employees() {
        Department deptIT = departmentRepository.findAll().stream()
                .filter(d -> "Information Technology".equalsIgnoreCase(d.getNameEn()))
                .findFirst()
                .orElseGet(() -> departmentRepository.save(Department.builder()
                        .nameEn("Information Technology")
                        .nameKh("បច្ចេកវិទ្យាព័ត៌មាន")
                        .description("Handles software development, infrastructure, and IT support")
                        .build()));

        Department deptHR = departmentRepository.findAll().stream()
                .filter(d -> "Human Resources".equalsIgnoreCase(d.getNameEn()))
                .findFirst()
                .orElseGet(() -> departmentRepository.save(Department.builder()
                        .nameEn("Human Resources")
                        .nameKh("ធនធានមនុស្ស")
                        .description("Manages recruitment, staff relations, payroll, and benefits")
                        .build()));

        Department deptFinance = departmentRepository.findAll().stream()
                .filter(d -> "Finance & Accounting".equalsIgnoreCase(d.getNameEn()) || "Finance".equalsIgnoreCase(d.getNameEn()))
                .findFirst()
                .orElseGet(() -> departmentRepository.save(Department.builder()
                        .nameEn("Finance & Accounting")
                        .nameKh("ហិរញ្ញវត្ថុ និងគណនេយ្យ")
                        .description("Financial management, bookkeeping, and payroll accounting")
                        .build()));

        Department deptMarketing = departmentRepository.findAll().stream()
                .filter(d -> "Marketing & Operations".equalsIgnoreCase(d.getNameEn()) || "Marketing".equalsIgnoreCase(d.getNameEn()))
                .findFirst()
                .orElseGet(() -> departmentRepository.save(Department.builder()
                        .nameEn("Marketing & Operations")
                        .nameKh("ទីផ្សារ និងប្រតិបត្តិការ")
                        .description("Brand marketing, digital campaigns, and daily business operations")
                        .build()));

        Position posITManager = getOrCreatePosition("IT Manager", "ប្រធានផ្នែកបច្ចេកវិទ្យាព័ត៌មាន", deptIT.getId());
        Position posSrDev = getOrCreatePosition("Senior Software Engineer", "វិស្វករកម្មវិធីជាន់ខ្ពស់", deptIT.getId());
        Position posDev = getOrCreatePosition("Software Developer", "អ្នកអភិវឌ្ឍន៍កម្មវិធី", deptIT.getId());
        Position posUIDesigner = getOrCreatePosition("UI/UX Designer", "អ្នករចនា UI/UX", deptIT.getId());
        Position posNetwork = getOrCreatePosition("Network Specialist", "អ្នកឯកទេសប្រព័ន្ធបណ្ដាញ", deptIT.getId());

        Position posHRManager = getOrCreatePosition("HR Manager", "ប្រធានគ្រប់គ្រងធនធានមនុស្ស", deptHR.getId());
        Position posHRSpecialist = getOrCreatePosition("HR Specialist", "អ្នកឯកទេសធនធានមនុស្ស", deptHR.getId());

        Position posFinanceMgr = getOrCreatePosition("Finance Manager", "ប្រធានផ្នែកហិរញ្ញវត្ថុ", deptFinance.getId());
        Position posAccountant = getOrCreatePosition("Senior Accountant", "គណនេយ្យករជាន់ខ្ពស់", deptFinance.getId());

        Position posMktLead = getOrCreatePosition("Marketing Lead", "ប្រធានផ្នែកទីផ្សារ", deptMarketing.getId());
        Position posOpsOfficer = getOrCreatePosition("Operations Officer", "មន្ត្រីប្រតិបត្តិការ", deptMarketing.getId());

        List<Employee> employeeSeedList = List.of(
                Employee.builder()
                        .staffId("EMP-001")
                        .nameEn("Khoem Piseth")
                        .nameKh("ខឹម ពិសិដ្ឋ")
                        .gender("Male")
                        .positionId(posITManager.getId())
                        .departmentId(deptIT.getId())
                        .branch("Phnom Penh HQ")
                        .joinDate(LocalDate.of(2024, 1, 15))
                        .status(Status.Active)
                        .shift1Start("08:00")
                        .shift1End("12:00")
                        .shift2Start("13:00")
                        .shift2End("17:00")
                        .email("admin@attendance.com")
                        .password(passwordEncoder.encode("admin123"))
                        .role(Role.Admin)
                        .build(),

                Employee.builder()
                        .staffId("EMP-002")
                        .nameEn("Keo Sophea")
                        .nameKh("កែវ សុភា")
                        .gender("Female")
                        .positionId(posHRManager.getId())
                        .departmentId(deptHR.getId())
                        .branch("Phnom Penh HQ")
                        .joinDate(LocalDate.of(2024, 3, 10))
                        .status(Status.Active)
                        .shift1Start("08:00")
                        .shift1End("12:00")
                        .shift2Start("13:00")
                        .shift2End("17:00")
                        .email("hr@attendance.com")
                        .password(passwordEncoder.encode("hr123"))
                        .role(Role.HR)
                        .build(),

                Employee.builder()
                        .staffId("EMP-003")
                        .nameEn("Chan Dara")
                        .nameKh("ចាន់ ដារ៉ា")
                        .gender("Male")
                        .positionId(posITManager.getId())
                        .departmentId(deptIT.getId())
                        .branch("Phnom Penh HQ")
                        .joinDate(LocalDate.of(2023, 11, 1))
                        .status(Status.Active)
                        .shift1Start("08:00")
                        .shift1End("12:00")
                        .shift2Start("13:00")
                        .shift2End("17:00")
                        .email("manager@attendance.com")
                        .password(passwordEncoder.encode("manager123"))
                        .role(Role.Manager)
                        .build(),

                Employee.builder()
                        .staffId("EMP-004")
                        .nameEn("Nguon Rath")
                        .nameKh("ងួន រ័ត្ន")
                        .gender("Male")
                        .positionId(posDev.getId())
                        .departmentId(deptIT.getId())
                        .branch("Phnom Penh HQ")
                        .joinDate(LocalDate.of(2025, 2, 20))
                        .status(Status.Active)
                        .shift1Start("08:00")
                        .shift1End("12:00")
                        .shift2Start("13:00")
                        .shift2End("17:00")
                        .email("rath@attendance.com")
                        .password(passwordEncoder.encode("emp123"))
                        .role(Role.Employee)
                        .build(),

                Employee.builder()
                        .staffId("EMP-005")
                        .nameEn("Phan Sreypov")
                        .nameKh("ផាន់ ស្រីពៅ")
                        .gender("Female")
                        .positionId(posUIDesigner.getId())
                        .departmentId(deptIT.getId())
                        .branch("Siem Reap Branch")
                        .joinDate(LocalDate.of(2025, 5, 1))
                        .status(Status.Active)
                        .shift1Start("08:30")
                        .shift1End("12:30")
                        .shift2Start("13:30")
                        .shift2End("17:30")
                        .email("sreypov@attendance.com")
                        .password(passwordEncoder.encode("emp123"))
                        .role(Role.Employee)
                        .build(),

                Employee.builder()
                        .staffId("EMP-006")
                        .nameEn("Heng Mengly")
                        .nameKh("ហេង ម៉េងលី")
                        .gender("Male")
                        .positionId(posSrDev.getId())
                        .departmentId(deptIT.getId())
                        .branch("Phnom Penh HQ")
                        .joinDate(LocalDate.of(2024, 6, 15))
                        .status(Status.Active)
                        .shift1Start("08:00")
                        .shift1End("12:00")
                        .shift2Start("13:00")
                        .shift2End("17:00")
                        .email("mengly@attendance.com")
                        .password(passwordEncoder.encode("emp123"))
                        .role(Role.Employee)
                        .build(),

                Employee.builder()
                        .staffId("EMP-007")
                        .nameEn("Youn Vichea")
                        .nameKh("យុន វិជ្ជា")
                        .gender("Male")
                        .positionId(posNetwork.getId())
                        .departmentId(deptIT.getId())
                        .branch("Phnom Penh HQ")
                        .joinDate(LocalDate.of(2024, 8, 1))
                        .status(Status.Active)
                        .shift1Start("08:00")
                        .shift1End("12:00")
                        .shift2Start("13:00")
                        .shift2End("17:00")
                        .email("vichea@attendance.com")
                        .password(passwordEncoder.encode("emp123"))
                        .role(Role.Employee)
                        .build(),

                Employee.builder()
                        .staffId("EMP-008")
                        .nameEn("Chhim Sokha")
                        .nameKh("ឈឹម សុខា")
                        .gender("Female")
                        .positionId(posFinanceMgr.getId())
                        .departmentId(deptFinance.getId())
                        .branch("Phnom Penh HQ")
                        .joinDate(LocalDate.of(2023, 9, 10))
                        .status(Status.Active)
                        .shift1Start("08:00")
                        .shift1End("12:00")
                        .shift2Start("13:00")
                        .shift2End("17:00")
                        .email("sokha@attendance.com")
                        .password(passwordEncoder.encode("manager123"))
                        .role(Role.Manager)
                        .build(),

                Employee.builder()
                        .staffId("EMP-009")
                        .nameEn("Long Bopha")
                        .nameKh("ឡុង បុប្ផា")
                        .gender("Female")
                        .positionId(posAccountant.getId())
                        .departmentId(deptFinance.getId())
                        .branch("Battambang Branch")
                        .joinDate(LocalDate.of(2024, 11, 20))
                        .status(Status.Active)
                        .shift1Start("08:00")
                        .shift1End("12:00")
                        .shift2Start("13:00")
                        .shift2End("17:00")
                        .email("bopha@attendance.com")
                        .password(passwordEncoder.encode("emp123"))
                        .role(Role.Employee)
                        .build(),

                Employee.builder()
                        .staffId("EMP-010")
                        .nameEn("Chea Sovann")
                        .nameKh("ជា សុវណ្ណ")
                        .gender("Male")
                        .positionId(posMktLead.getId())
                        .departmentId(deptMarketing.getId())
                        .branch("Phnom Penh HQ")
                        .joinDate(LocalDate.of(2023, 12, 5))
                        .status(Status.Active)
                        .shift1Start("08:00")
                        .shift1End("12:00")
                        .shift2Start("13:00")
                        .shift2End("17:00")
                        .email("sovann@attendance.com")
                        .password(passwordEncoder.encode("manager123"))
                        .role(Role.Manager)
                        .build(),

                Employee.builder()
                        .staffId("EMP-011")
                        .nameEn("Tep Kanha")
                        .nameKh("ទេព កញ្ញា")
                        .gender("Female")
                        .positionId(posHRSpecialist.getId())
                        .departmentId(deptHR.getId())
                        .branch("Siem Reap Branch")
                        .joinDate(LocalDate.of(2025, 1, 10))
                        .status(Status.Active)
                        .shift1Start("08:00")
                        .shift1End("12:00")
                        .shift2Start("13:00")
                        .shift2End("17:00")
                        .email("kanha@attendance.com")
                        .password(passwordEncoder.encode("emp123"))
                        .role(Role.Employee)
                        .build(),

                Employee.builder()
                        .staffId("EMP-012")
                        .nameEn("Vannak Rithy")
                        .nameKh("វណ្ណៈ រិទ្ធី")
                        .gender("Male")
                        .positionId(posOpsOfficer.getId())
                        .departmentId(deptMarketing.getId())
                        .branch("Sihanoukville Branch")
                        .joinDate(LocalDate.of(2025, 3, 1))
                        .status(Status.Active)
                        .shift1Start("08:00")
                        .shift1End("12:00")
                        .shift2Start("13:00")
                        .shift2End("17:00")
                        .email("rithy@attendance.com")
                        .password(passwordEncoder.encode("emp123"))
                        .role(Role.Employee)
                        .build()
        );

        int createdCount = 0;
        for (Employee emp : employeeSeedList) {
            if (!employeeRepository.existsByStaffId(emp.getStaffId()) && !employeeRepository.existsByEmail(emp.getEmail())) {
                employeeRepository.save(emp);
                createdCount++;
            }
        }

        return ResponseEntity.ok(Map.of(
                "message", "Successfully seeded employees",
                "createdCount", createdCount,
                "totalCount", employeeRepository.count()
        ));
    }

    private Position getOrCreatePosition(String titleEn, String titleKh, UUID deptId) {
        return positionRepository.findAll().stream()
                .filter(p -> titleEn.equalsIgnoreCase(p.getTitleEn()))
                .findFirst()
                .orElseGet(() -> positionRepository.save(Position.builder()
                        .titleEn(titleEn)
                        .titleKh(titleKh)
                        .departmentId(deptId)
                        .build()));
    }
}
