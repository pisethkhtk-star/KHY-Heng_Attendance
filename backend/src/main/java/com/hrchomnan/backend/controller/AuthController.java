package com.hrchomnan.backend.controller;

import com.hrchomnan.backend.enums.Role;
import com.hrchomnan.backend.enums.Status;
import com.hrchomnan.backend.model.Department;
import com.hrchomnan.backend.model.Employee;
import com.hrchomnan.backend.model.EmployeeQRCode;
import com.hrchomnan.backend.model.Position;
import com.hrchomnan.backend.model.RolePermission;
import com.hrchomnan.backend.repository.DepartmentRepository;
import com.hrchomnan.backend.repository.EmployeeFaceDataRepository;
import com.hrchomnan.backend.repository.EmployeeQRCodeRepository;
import com.hrchomnan.backend.repository.EmployeeRepository;
import com.hrchomnan.backend.repository.PositionRepository;
import com.hrchomnan.backend.repository.RolePermissionRepository;
import com.hrchomnan.backend.security.JwtUtil;
import com.hrchomnan.backend.util.QrCodeHelper;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/auth")
@Transactional
@RequiredArgsConstructor
public class AuthController {

    private final EmployeeRepository employeeRepository;
    private final RolePermissionRepository rolePermissionRepository;
    private final DepartmentRepository departmentRepository;
    private final PositionRepository positionRepository;
    private final EmployeeQRCodeRepository employeeQRCodeRepository;
    private final EmployeeFaceDataRepository employeeFaceDataRepository;
    private final QrCodeHelper qrCodeHelper;
    private final JwtUtil jwtUtil;
    private final PasswordEncoder passwordEncoder;

    // ---- Brute-force protection (in-memory, resets on restart) ----
    private static final int MAX_FAILED_ATTEMPTS = 13;
    private static final long LOCKOUT_DURATION_MS = 10 * 60 * 1000L; // 10 minutes
    private final ConcurrentHashMap<String, Integer> failedAttempts = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Long> lockoutUntil = new ConcurrentHashMap<>();

    private boolean isLockedOut(String email) {
        Long until = lockoutUntil.get(email);
        if (until != null && System.currentTimeMillis() < until) return true;
        if (until != null) { lockoutUntil.remove(email); failedAttempts.remove(email); }
        return false;
    }

    private void recordFailure(String email) {
        int count = failedAttempts.merge(email, 1, Integer::sum);
        if (count >= MAX_FAILED_ATTEMPTS) {
            lockoutUntil.put(email, System.currentTimeMillis() + LOCKOUT_DURATION_MS);
        }
    }

    private void clearFailures(String email) {
        failedAttempts.remove(email);
        lockoutUntil.remove(email);
    }

    @Data
    public static class LoginRequest {
        private String email;
        private String password;
        private String client; // "web" or "mobile"
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        if (request.getEmail() == null || request.getPassword() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Please provide email and password"));
        }

        String email = request.getEmail().trim().toLowerCase();

        // Brute-force check: block if locked out
        if (isLockedOut(email)) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(Map.of(
                "message", "Account temporarily locked due to too many failed attempts. Try again in 10 minutes.",
                "code", "ACCOUNT_LOCKED"
            ));
        }

        Optional<Employee> employeeOpt = employeeRepository.findByEmail(email);
        if (employeeOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Invalid email or password"));
        }

        Employee employee = employeeOpt.get();

        if (employee.getStatus() != Status.Active) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Your account is inactive. Please contact HR."));
        }

        // Web login restriction: Only accounts with canLoginWeb = true or Admin role can log into web
        boolean isWebRequest = "web".equalsIgnoreCase(request.getClient());
        if (isWebRequest && employee.getRole() != Role.Admin) {
            if (!Boolean.TRUE.equals(employee.getCanLoginWeb())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                        "message", "គណនីនេះមិនត្រូវបានអនុញ្ញាតឱ្យ Login ចូលក្នុង Website ទេ (Web login is disabled). សូមទាក់ទង Admin!",
                        "code", "WEB_LOGIN_DISABLED"
                ));
            }
        }

        // Only use BCrypt comparison - no plain-text fallback
        boolean isMatch = passwordEncoder.matches(request.getPassword(), employee.getPassword());

        if (!isMatch) {
            recordFailure(email); // Track failed attempt
            int remaining = MAX_FAILED_ATTEMPTS - failedAttempts.getOrDefault(email, 0);
            String hint = remaining > 0 ? " (" + remaining + " attempts remaining before lockout)" : " Account is now locked for 10 min.";
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Invalid email or password" + hint));
        }

        clearFailures(email); // Reset on successful login

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
    @PreAuthorize("isAuthenticated()")
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

        // Support JSON formatted QR payload
        if (staffId == null && cleanToken.startsWith("{") && cleanToken.endsWith("}")) {
            try {
                if (cleanToken.contains("staffId")) {
                    int idx = cleanToken.indexOf("\"staffId\"");
                    String sub = cleanToken.substring(idx + 10).replaceAll("[\":},]", "").trim();
                    staffId = sub;
                } else if (cleanToken.contains("qrToken")) {
                    int idx = cleanToken.indexOf("\"qrToken\"");
                    String sub = cleanToken.substring(idx + 10).replaceAll("[\":},]", "").trim();
                    staffId = qrCodeHelper.verifySecureToken(sub);
                    if (staffId == null) {
                        Optional<EmployeeQRCode> qrRecord = employeeQRCodeRepository.findByQrToken(sub);
                        if (qrRecord.isPresent()) staffId = qrRecord.get().getStaffId();
                    }
                }
            } catch (Exception ignored) {}
        }

        // Security: Do NOT allow plain staffId or email as QR token (bypass risk)
        // Only accept: secure signed token, registered QR token, or QR_TOKEN_ format

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
        map.put("isFlexible", employee.getIsFlexible() != null ? employee.getIsFlexible() : false);
        map.put("flexibleSchedule", employee.getFlexibleSchedule() != null ? employee.getFlexibleSchedule() : "{}");
        map.put("address", employee.getAddress());
        // Note: idCardPassport removed from response for security (PII protection)
        String userPhoto = employee.getPhotoUrl();
        if ((userPhoto == null || userPhoto.isBlank()) && employee.getStaffId() != null) {
            userPhoto = employeeFaceDataRepository.findByStaffId(employee.getStaffId())
                    .map(com.hrchomnan.backend.model.EmployeeFaceData::getPhotoUrl)
                    .orElse(null);
        }
        map.put("photoUrl", userPhoto);

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

        List<String> allowedResources;
        if (employee.getCustomPermissions() != null && !employee.getCustomPermissions().isBlank()) {
            try {
                com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
                allowedResources = mapper.readValue(employee.getCustomPermissions(), new com.fasterxml.jackson.core.type.TypeReference<List<String>>() {});
            } catch (Exception e) {
                allowedResources = Arrays.stream(employee.getCustomPermissions().split(","))
                        .map(String::trim)
                        .filter(s -> !s.isEmpty())
                        .collect(Collectors.toList());
            }
        } else {
            List<RolePermission> permissions = rolePermissionRepository.findByRole(employee.getRole());
            allowedResources = permissions.stream()
                    .filter(p -> Boolean.TRUE.equals(p.getCanAccess()))
                    .map(RolePermission::getResource)
                    .collect(Collectors.toList());
        }

        map.put("permissions", allowedResources);
        map.put("hasCustomPermissions", employee.getCustomPermissions() != null && !employee.getCustomPermissions().isBlank());
        return map;
    }
}
