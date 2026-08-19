package com.hrchomnan.backend1.controller;

import com.hrchomnan.backend1.enums.Status;
import com.hrchomnan.backend1.model.Department;
import com.hrchomnan.backend1.model.Employee;
import com.hrchomnan.backend1.model.EmployeeQRCode;
import com.hrchomnan.backend1.model.Position;
import com.hrchomnan.backend1.model.RolePermission;
import com.hrchomnan.backend1.repository.DepartmentRepository;
import com.hrchomnan.backend1.repository.EmployeeQRCodeRepository;
import com.hrchomnan.backend1.repository.EmployeeRepository;
import com.hrchomnan.backend1.repository.PositionRepository;
import com.hrchomnan.backend1.repository.RolePermissionRepository;
import com.hrchomnan.backend1.security.JwtUtil;
import com.hrchomnan.backend1.util.QrCodeHelper;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final EmployeeRepository employeeRepository;
    private final RolePermissionRepository rolePermissionRepository;
    private final DepartmentRepository departmentRepository;
    private final PositionRepository positionRepository;
    private final EmployeeQRCodeRepository employeeQRCodeRepository;
    private final QrCodeHelper qrCodeHelper;
    private final JwtUtil jwtUtil;
    private final PasswordEncoder passwordEncoder;

    @Data
    public static class LoginRequest {
        private String email;
        private String password;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        if (request.getEmail() == null || request.getPassword() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Please provide email and password"));
        }

        Optional<Employee> employeeOpt = employeeRepository.findByEmail(request.getEmail());
        if (employeeOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Invalid email or password"));
        }

        Employee employee = employeeOpt.get();

        if (employee.getStatus() != Status.Active) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Your account is inactive. Please contact HR."));
        }

        boolean isMatch = passwordEncoder.matches(request.getPassword(), employee.getPassword())
                || request.getPassword().equals(employee.getPassword());

        if (!isMatch) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Invalid email or password"));
        }

        String token = jwtUtil.generateToken(
                employee.getEmail(),
                employee.getId().toString(),
                employee.getStaffId(),
                employee.getRole().name()
        );

        Map<String, Object> employeeData = buildEmployeeResponse(employee);

        return ResponseEntity.ok(Map.of(
                "token", token,
                "user", employeeData
        ));
    }

    @GetMapping("/me")
    public ResponseEntity<?> getMe(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof Employee employee)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Unauthorized"));
        }

        // Re-fetch latest from DB to ensure freshest state
        Optional<Employee> freshOpt = employeeRepository.findById(employee.getId());
        Employee fresh = freshOpt.orElse(employee);

        Map<String, Object> employeeData = buildEmployeeResponse(fresh);
        return ResponseEntity.ok(employeeData);
    }

    @Data
    public static class QrLoginRequest {
        private String qrToken;
    }

    @PostMapping("/login-qr")
    public ResponseEntity<?> loginWithQRCode(@RequestBody QrLoginRequest request) {
        if (request.getQrToken() == null || request.getQrToken().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "QR token is required"));
        }

        String cleanToken = request.getQrToken().trim();
        String staffId = qrCodeHelper.verifySecureToken(cleanToken);

        if (staffId == null) {
            Optional<EmployeeQRCode> qrRecord = employeeQRCodeRepository.findByQrToken(cleanToken);
            if (qrRecord.isPresent() && Boolean.TRUE.equals(qrRecord.get().getIsActive())) {
                staffId = qrRecord.get().getStaffId();
            } else if (cleanToken.startsWith("QR_TOKEN_")) {
                String[] parts = cleanToken.split("_");
                if (parts.length >= 3) {
                    staffId = parts[2];
                }
            }
        }

        if (staffId == null) {
            // Check if cleanToken matches a staffId or email directly
            Optional<Employee> directEmp = employeeRepository.findByStaffId(cleanToken);
            if (directEmp.isPresent()) {
                staffId = directEmp.get().getStaffId();
            }
        }

        if (staffId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "លេខកូដ QR មិនត្រឹមត្រូវ ឬអស់សុពលភាព (Invalid or expired QR code)"));
        }

        Optional<Employee> employeeOpt = employeeRepository.findByStaffId(staffId);
        if (employeeOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "រកមិនឃើញគណនីបុគ្គលិកតាមរយៈ QR Code នេះឡើយ (Employee not found for this QR)"));
        }

        Employee employee = employeeOpt.get();
        if (employee.getStatus() != Status.Active) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Your account is inactive. Please contact HR."));
        }

        String token = jwtUtil.generateToken(
                employee.getEmail(),
                employee.getId().toString(),
                employee.getStaffId(),
                employee.getRole().name()
        );

        Map<String, Object> employeeData = buildEmployeeResponse(employee);

        return ResponseEntity.ok(Map.of(
                "token", token,
                "user", employeeData
        ));
    }

    private Map<String, Object> buildEmployeeResponse(Employee employee) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", employee.getId());
        map.put("staffId", employee.getStaffId());
        map.put("nameEn", employee.getNameEn());
        map.put("nameKh", employee.getNameKh());
        map.put("email", employee.getEmail());
        map.put("gender", employee.getGender());
        map.put("role", employee.getRole());
        map.put("status", employee.getStatus());
        map.put("departmentId", employee.getDepartmentId());
        map.put("positionId", employee.getPositionId());
        map.put("branch", employee.getBranch());
        map.put("joinDate", employee.getJoinDate());
        map.put("shift1Start", employee.getShift1Start());
        map.put("shift1End", employee.getShift1End());
        map.put("shift2Start", employee.getShift2Start());
        map.put("shift2End", employee.getShift2End());
        map.put("address", employee.getAddress());
        map.put("idCardPassport", employee.getIdCardPassport());
        map.put("photoUrl", employee.getPhotoUrl());

        if (employee.getDepartmentId() != null) {
            departmentRepository.findById(employee.getDepartmentId()).ifPresent(d -> {
                map.put("department", Map.of("nameEn", d.getNameEn(), "nameKh", d.getNameKh()));
            });
        }
        if (map.get("department") == null) {
            map.put("department", null);
        }

        if (employee.getPositionId() != null) {
            positionRepository.findById(employee.getPositionId()).ifPresent(p -> {
                map.put("position", Map.of("titleEn", p.getTitleEn(), "titleKh", p.getTitleKh()));
            });
        }
        if (map.get("position") == null) {
            map.put("position", null);
        }

        List<RolePermission> permissions = rolePermissionRepository.findByRole(employee.getRole());
        List<String> allowedResources = permissions.stream()
                .filter(p -> Boolean.TRUE.equals(p.getCanAccess()))
                .map(RolePermission::getResource)
                .collect(Collectors.toList());

        map.put("permissions", allowedResources);
        return map;
    }
}
