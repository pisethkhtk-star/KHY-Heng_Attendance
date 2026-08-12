package com.hrchomnan.backend1.controller;

import com.hrchomnan.backend1.enums.Status;
import com.hrchomnan.backend1.model.Employee;
import com.hrchomnan.backend1.model.RolePermission;
import com.hrchomnan.backend1.repository.EmployeeRepository;
import com.hrchomnan.backend1.repository.RolePermissionRepository;
import com.hrchomnan.backend1.security.JwtUtil;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final EmployeeRepository employeeRepository;
    private final RolePermissionRepository rolePermissionRepository;
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

        // Support plain text comparison (for test seeds) or bcrypt comparison
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

        Map<String, Object> employeeData = buildEmployeeResponse(employee);
        return ResponseEntity.ok(employeeData);
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

        List<RolePermission> permissions = rolePermissionRepository.findByRole(employee.getRole());
        List<String> allowedResources = permissions.stream()
                .filter(p -> Boolean.TRUE.equals(p.getCanAccess()))
                .map(RolePermission::getResource)
                .collect(Collectors.toList());

        map.put("permissions", allowedResources);
        return map;
    }
}
