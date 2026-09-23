package com.hrchomnan.backend.service.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hrchomnan.backend.constants.Constants;
import com.hrchomnan.backend.enums.Role;
import com.hrchomnan.backend.enums.Status;
import com.hrchomnan.backend.exception.AppException;
import com.hrchomnan.backend.exception.ResourceNotFoundException;
import com.hrchomnan.backend.model.Employee;
import com.hrchomnan.backend.model.EmployeeQRCode;
import com.hrchomnan.backend.model.RolePermission;
import com.hrchomnan.backend.payload.request.LoginReq;
import com.hrchomnan.backend.payload.request.QrLoginReq;
import com.hrchomnan.backend.payload.response.JwtRes;
import com.hrchomnan.backend.repository.DepartmentRepository;
import com.hrchomnan.backend.repository.EmployeeFaceDataRepository;
import com.hrchomnan.backend.repository.EmployeeQRCodeRepository;
import com.hrchomnan.backend.repository.EmployeeRepository;
import com.hrchomnan.backend.repository.PositionRepository;
import com.hrchomnan.backend.repository.RolePermissionRepository;
import com.hrchomnan.backend.security.JwtUtil;
import com.hrchomnan.backend.service.AuthService;
import com.hrchomnan.backend.util.QrCodeHelper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthServiceImpl implements AuthService {

    private final EmployeeRepository employeeRepository;
    private final RolePermissionRepository rolePermissionRepository;
    private final DepartmentRepository departmentRepository;
    private final PositionRepository positionRepository;
    private final EmployeeQRCodeRepository employeeQRCodeRepository;
    private final EmployeeFaceDataRepository employeeFaceDataRepository;
    private final QrCodeHelper qrCodeHelper;
    private final JwtUtil jwtUtil;
    private final PasswordEncoder passwordEncoder;
    private final ObjectMapper objectMapper = new ObjectMapper();

    // ---- Brute-force protection ----
    private static final int MAX_FAILED_ATTEMPTS = 13;
    private static final long LOCKOUT_DURATION_MS = 10 * 60 * 1000L;
    private final ConcurrentHashMap<String, Integer> failedAttempts = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Long> lockoutUntil = new ConcurrentHashMap<>();

    private boolean isLockedOut(String email) {
        Long until = lockoutUntil.get(email);
        if (until != null && System.currentTimeMillis() < until) return true;
        if (until != null) {
            lockoutUntil.remove(email);
            failedAttempts.remove(email);
        }
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

    @Override
    @Transactional(readOnly = true)
    public JwtRes login(LoginReq request) {
        if (request.getEmail() == null || request.getPassword() == null) {
            throw new BadCredentialsException("Please provide email and password");
        }

        String email = request.getEmail().trim().toLowerCase();

        if (isLockedOut(email)) {
            throw new AppException("Account temporarily locked due to too many failed attempts. Try again in 10 minutes.",
                    "គណនីត្រូវបានចាក់សោបណ្តោះអាសន្នដោយសារការប៉ុនប៉ងបរាជ័យច្រើនដង។ សូមព្យាយាមម្តងទៀតក្នុងរយៈពេល 10 នាទី។");
        }

        Employee employee = employeeRepository.findByEmail(email)
                .orElseThrow(() -> new BadCredentialsException("Invalid email or password"));

        if (employee.getStatus() != Status.Active) {
            throw new AppException("Your account is inactive. Please contact HR.", "គណនីរបស់អ្នកអសកម្ម។ សូមទាក់ទងមក HR។");
        }

        boolean isWebRequest = "web".equalsIgnoreCase(request.getClient());
        if (isWebRequest && employee.getRole() != Role.Admin) {
            if (!Boolean.TRUE.equals(employee.getCanLoginWeb())) {
                throw new AppException("Web login is disabled for this account. Please contact Admin!",
                        "គណនីនេះមិនត្រូវបានអនុញ្ញាតឱ្យ Login ចូលក្នុង Website ទេ (Web login is disabled). សូមទាក់ទង Admin!");
            }
        }

        boolean isMatch = passwordEncoder.matches(request.getPassword(), employee.getPassword());
        if (!isMatch) {
            recordFailure(email);
            int remaining = MAX_FAILED_ATTEMPTS - failedAttempts.getOrDefault(email, 0);
            String hint = remaining > 0 ? " (" + remaining + " attempts remaining before lockout)" : " Account is now locked for 10 min.";
            throw new BadCredentialsException("Invalid email or password" + hint);
        }

        clearFailures(email);

        String token = jwtUtil.generateToken(
                employee.getEmail(),
                employee.getId().toString(),
                employee.getStaffId(),
                employee.getRole().name()
        );

        Map<String, Object> employeeData = buildEmployeeResponse(employee);

        @SuppressWarnings("unchecked")
        List<String> permissions = (List<String>) employeeData.get("permissions");

        return JwtRes.builder()
                .token(token)
                .accessToken(token)
                .tokenType(Constants.BEARER)
                .expiresIn(86400000L)
                .user(employeeData)
                .role(employee.getRole().name())
                .permissions(permissions)
                .code(Constants.CODE_SUCCESS)
                .message("Login successful")
                .messageKh("ចូលប្រព័ន្ធដោយជោគជ័យ")
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public JwtRes loginWithQr(QrLoginReq request) {
        if (request.getQrToken() == null || request.getQrToken().isBlank()) {
            throw new BadCredentialsException("QR token is required");
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

        if (staffId == null) {
            throw new BadCredentialsException("Invalid or expired QR code");
        }

        Employee employee = employeeRepository.findByStaffId(staffId)
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found for this QR code"));

        if (employee.getStatus() != Status.Active) {
            throw new AppException("Your account is inactive. Please contact HR.", "គណនីរបស់អ្នកអសកម្ម។ សូមទាក់ទងមក HR។");
        }

        String token = jwtUtil.generateToken(
                employee.getEmail(),
                employee.getId().toString(),
                employee.getStaffId(),
                employee.getRole().name()
        );

        Map<String, Object> employeeData = buildEmployeeResponse(employee);

        @SuppressWarnings("unchecked")
        List<String> permissions = (List<String>) employeeData.get("permissions");

        return JwtRes.builder()
                .token(token)
                .accessToken(token)
                .tokenType(Constants.BEARER)
                .expiresIn(86400000L)
                .user(employeeData)
                .role(employee.getRole().name())
                .permissions(permissions)
                .code(Constants.CODE_SUCCESS)
                .message("QR Login successful")
                .messageKh("ចូលប្រព័ន្ធតាមរយៈ QR ដោយជោគជ័យ")
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> getMe(Employee employee) {
        Employee fresh = employeeRepository.findById(employee.getId()).orElse(employee);
        return buildEmployeeResponse(fresh);
    }

    @Override
    @Transactional
    public Map<String, Object> updateAvatar(Employee employee, String avatarUrl) {
        Employee fresh = employeeRepository.findById(employee.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Employee", "id", employee.getId()));

        fresh.setPhotoUrl(avatarUrl);
        employeeRepository.save(fresh);
        return buildEmployeeResponse(fresh);
    }

    @Override
    public Map<String, Object> buildEmployeeResponse(Employee employee) {
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
                allowedResources = objectMapper.readValue(employee.getCustomPermissions(), new TypeReference<List<String>>() {});
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
