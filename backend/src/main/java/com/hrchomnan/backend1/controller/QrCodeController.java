package com.hrchomnan.backend1.controller;

import com.hrchomnan.backend1.enums.Status;
import com.hrchomnan.backend1.model.AttendanceLog;
import com.hrchomnan.backend1.model.Department;
import com.hrchomnan.backend1.model.Employee;
import com.hrchomnan.backend1.model.EmployeeQRCode;
import com.hrchomnan.backend1.model.KioskSetting;
import com.hrchomnan.backend1.repository.AttendanceLogRepository;
import com.hrchomnan.backend1.repository.DepartmentRepository;
import com.hrchomnan.backend1.repository.EmployeeQRCodeRepository;
import com.hrchomnan.backend1.repository.EmployeeRepository;
import com.hrchomnan.backend1.repository.KioskSettingRepository;
import com.hrchomnan.backend1.security.JwtUtil;
import com.hrchomnan.backend1.util.AttendanceHelper;
import com.hrchomnan.backend1.util.QrCodeHelper;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/qrcode")
@RequiredArgsConstructor
@Slf4j
public class QrCodeController {

    private final EmployeeQRCodeRepository qrCodeRepository;
    private final EmployeeRepository employeeRepository;
    private final KioskSettingRepository kioskSettingRepository;
    private final AttendanceLogRepository attendanceLogRepository;
    private final DepartmentRepository departmentRepository;
    private final QrCodeHelper qrCodeHelper;
    private final AttendanceHelper attendanceHelper;
    private final JwtUtil jwtUtil;

    @GetMapping("/generate/{staffId}")
    public ResponseEntity<?> generateQRCode(@PathVariable String staffId) {
        Optional<Employee> empOpt = employeeRepository.findByStaffId(staffId);
        if (empOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Employee not found"));
        }

        try {
            String token = qrCodeHelper.generateSecureToken(staffId);

            Optional<EmployeeQRCode> existingOpt = qrCodeRepository.findByQrToken(token);
            if (existingOpt.isEmpty()) {
                // Invalidate old QR codes
                List<EmployeeQRCode> oldCodes = qrCodeRepository.findByStaffId(staffId);
                for (EmployeeQRCode old : oldCodes) {
                    old.setIsActive(false);
                    qrCodeRepository.save(old);
                }

                EmployeeQRCode newQr = EmployeeQRCode.builder()
                        .staffId(staffId)
                        .qrToken(token)
                        .isActive(true)
                        .build();
                qrCodeRepository.save(newQr);
            }

            String qrImage = qrCodeHelper.generateQrCodeBase64(token, 300, 300);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "qrToken", token,
                    "qrImage", qrImage
            ));
        } catch (Exception e) {
            log.error("Error generating QR code for staffId: {}", staffId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("message", "Server error generating QR code"));
        }
    }

    @Data
    public static class ScanRequest {
        private String qrToken;
        private String deviceInfo;
        private String location;
        private Double latitude;
        private Double longitude;
        private String action;
        private String note;
    }

    @PostMapping("/scan")
    public ResponseEntity<?> scanQRCode(@RequestBody ScanRequest request,
                                         @RequestHeader(value = "Authorization", required = false) String authHeader) {
        if (request.getQrToken() == null || request.getQrToken().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "QR token is required"));
        }

        String cleanToken = request.getQrToken().trim();

        // Fallback: If it's a branch QR token, handle it as a branch QR scan
        if (cleanToken.startsWith("branch_qr:")) {
            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                try {
                    String jwtToken = authHeader.substring(7);
                    String email = jwtUtil.extractEmail(jwtToken);
                    Optional<Employee> empOpt = employeeRepository.findByEmail(email);
                    if (empOpt.isPresent() && jwtUtil.validateToken(jwtToken, email)) {
                        return processBranchQrScan(empOpt.get(), cleanToken, request);
                    }
                } catch (Exception e) {
                    log.error("Failed to authenticate branch QR scan via fallback:", e);
                }
            }
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                    "success", false,
                    "message", "Authentication token is required or invalid for branch QR scanning"
            ));
        }

        // 1. Verify token signature
        String staffId = qrCodeHelper.verifySecureToken(cleanToken);
        if (staffId == null) {
            // Check active in DB
            Optional<EmployeeQRCode> qrOpt = qrCodeRepository.findByQrToken(cleanToken);
            if (qrOpt.isPresent() && Boolean.TRUE.equals(qrOpt.get().getIsActive())) {
                staffId = qrOpt.get().getStaffId();
            }
        }

        if (staffId == null) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Invalid QR signature or corrupted data"));
        }

        Optional<Employee> empOpt = employeeRepository.findByStaffId(staffId);
        if (empOpt.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Employee not found"));
        }
        Employee employee = empOpt.get();

        // Geofence check
        List<KioskSetting> settingsList = kioskSettingRepository.findAll();
        if (!settingsList.isEmpty()) {
            if (request.getLatitude() == null || request.getLongitude() == null) {
                return ResponseEntity.badRequest().body(Map.of(
                        "success", false,
                        "message", "Location data (GPS) is required to check-in. សូមបើក Location (GPS) លើឧបករណ៍របស់អ្នក។"
                ));
            }

            double clientLat = request.getLatitude();
            double clientLng = request.getLongitude();

            List<String> employeeBranches = (employee.getBranch() != null && !employee.getBranch().isBlank())
                    ? Arrays.stream(employee.getBranch().split(",")).map(s -> s.trim().toLowerCase()).toList()
                    : Collections.emptyList();

            List<KioskSetting> allowedSettingsList = settingsList.stream()
                    .filter(s -> employeeBranches.contains(s.getName().trim().toLowerCase()))
                    .toList();

            if (allowedSettingsList.isEmpty() && !employeeBranches.isEmpty()) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                        "success", false,
                        "message", "គណនីរបស់អ្នកមិនទាន់ត្រូវបានកំណត់ឱ្យចុះវត្តមាននៅសាខាណាមួយឡើយ! (Employee is not assigned to any active branch settings)."
                ));
            }

            List<KioskSetting> checkList = allowedSettingsList.isEmpty() ? settingsList : allowedSettingsList;
            boolean isInsideAnyZone = false;
            String closestZoneName = null;
            double closestDistance = Double.MAX_VALUE;
            double closestRadius = 100.0;

            for (KioskSetting ks : checkList) {
                double distance = getHaversineDistance(clientLat, clientLng, ks.getLatitude(), ks.getLongitude());
                if (distance <= ks.getRadius()) {
                    isInsideAnyZone = true;
                    break;
                }
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestZoneName = ks.getName();
                    closestRadius = ks.getRadius();
                }
            }

            if (!isInsideAnyZone) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                        "success", false,
                        "message", closestZoneName != null
                                ? "ក្រៅទីតាំងអនុញ្ញាត! (Out of allowed zone). Closest branch \"" + closestZoneName + "\" is " + Math.round(closestDistance) + "m away (limit is " + closestRadius + "m)."
                                : "ក្រៅទីតាំងអនុញ្ញាត! (Out of allowed zone)."
                ));
            }
        }

        // 2. Query QR record from database to verify active status
        Optional<EmployeeQRCode> qrRecordOpt = qrCodeRepository.findByQrToken(cleanToken);
        if (qrRecordOpt.isPresent() && !Boolean.TRUE.equals(qrRecordOpt.get().getIsActive())) {
            attendanceLogRepository.save(AttendanceLog.builder()
                    .staffId(staffId)
                    .method("qrcode")
                    .action("UNKNOWN")
                    .status("failed")
                    .deviceInfo(request.getDeviceInfo() != null ? request.getDeviceInfo() : "Kiosk Scanner")
                    .location(request.getLocation() != null ? request.getLocation() : "HQ Lobby")
                    .build());

            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "This QR code is inactive or has been revoked"));
        }

        // 3. Process check-in
        String note = request.getNote() != null && !request.getNote().isBlank() ? request.getNote() : "Auto scan: QR Code";
        AttendanceHelper.ScanResult result = attendanceHelper.processAttendanceScan(
                staffId,
                request.getAction(),
                null,
                null,
                note
        );

        // 4. Create successful audit log
        attendanceLogRepository.save(AttendanceLog.builder()
                .staffId(staffId)
                .method("qrcode")
                .action(result.getAction())
                .status("success")
                .deviceInfo(request.getDeviceInfo() != null ? request.getDeviceInfo() : "Kiosk Scanner")
                .location(request.getLocation() != null ? request.getLocation() : "HQ Lobby")
                .build());

        String deptName = "N/A";
        if (employee.getDepartmentId() != null) {
            Optional<Department> dOpt = departmentRepository.findById(employee.getDepartmentId());
            if (dOpt.isPresent()) deptName = dOpt.get().getNameEn();
        }

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Checked in Sok! Action: " + result.getAction(),
                "employee", Map.of(
                        "staffId", employee.getStaffId(),
                        "nameEn", employee.getNameEn(),
                        "nameKh", employee.getNameKh(),
                        "department", deptName
                ),
                "action", result.getAction(),
                "timeString", result.getTimeString()
        ));
    }

    @PostMapping("/scan-branch")
    public ResponseEntity<?> scanBranchQRCode(@RequestBody ScanRequest request, Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof Employee employee)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Authentication required"));
        }

        if (request.getQrToken() == null || request.getQrToken().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "QR token is required"));
        }

        return processBranchQrScan(employee, request.getQrToken().trim(), request);
    }

    private ResponseEntity<?> processBranchQrScan(Employee employee, String cleanToken, ScanRequest request) {
        if (!cleanToken.startsWith("branch_qr:")) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Invalid Branch QR code format"));
        }

        String branchIdStr = cleanToken.replace("branch_qr:", "").trim();
        UUID branchId;
        try {
            branchId = UUID.fromString(branchIdStr);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Invalid branch ID in QR"));
        }

        Optional<KioskSetting> branchOpt = kioskSettingRepository.findById(branchId);
        if (branchOpt.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Branch location not found"));
        }
        KioskSetting branch = branchOpt.get();

        if (employee.getStatus() != Status.Active) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("success", false, "message", "Employee account is inactive"));
        }

        if (request.getLatitude() == null || request.getLongitude() == null) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "Location data (GPS) is required to check-in. សូមបើក Location (GPS) លើឧបករណ៍របស់អ្នក។"
            ));
        }

        double clientLat = request.getLatitude();
        double clientLng = request.getLongitude();

        List<String> employeeBranches = (employee.getBranch() != null && !employee.getBranch().isBlank())
                ? Arrays.stream(employee.getBranch().split(",")).map(s -> s.trim().toLowerCase()).toList()
                : Collections.emptyList();

        if (!employeeBranches.isEmpty() && !employeeBranches.contains(branch.getName().trim().toLowerCase())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                    "success", false,
                    "message", "គណនីរបស់អ្នកមិនទាន់ត្រូវបានកំណត់ឱ្យចុះវត្តមាននៅសាខា \"" + branch.getName() + "\" ឡើយ!"
            ));
        }

        double distance = getHaversineDistance(clientLat, clientLng, branch.getLatitude(), branch.getLongitude());
        if (distance > branch.getRadius()) {
            long delta = Math.round(distance - branch.getRadius());
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                    "success", false,
                    "message", "ក្រៅទីតាំងអនុញ្ញាត! (Out of allowed zone). You are " + delta + "m away from the branch \"" + branch.getName() + "\" (limit is " + branch.getRadius() + "m)."
            ));
        }

        String note = request.getNote() != null && !request.getNote().isBlank() ? request.getNote() : "Auto scan: Branch QR (" + branch.getName() + ")";
        AttendanceHelper.ScanResult result = attendanceHelper.processAttendanceScan(
                employee.getStaffId(),
                request.getAction(),
                null,
                null,
                note
        );

        attendanceLogRepository.save(AttendanceLog.builder()
                .staffId(employee.getStaffId())
                .method("qrcode")
                .action(result.getAction())
                .status("success")
                .deviceInfo(request.getDeviceInfo() != null ? request.getDeviceInfo() : "Mobile App")
                .location(branch.getName())
                .build());

        String deptName = "N/A";
        if (employee.getDepartmentId() != null) {
            Optional<Department> dOpt = departmentRepository.findById(employee.getDepartmentId());
            if (dOpt.isPresent()) deptName = dOpt.get().getNameEn();
        }

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Checked in Sok! Action: " + result.getAction(),
                "employee", Map.of(
                        "staffId", employee.getStaffId(),
                        "nameEn", employee.getNameEn(),
                        "nameKh", employee.getNameKh(),
                        "department", deptName
                ),
                "action", result.getAction(),
                "timeString", result.getTimeString()
        ));
    }

    private double getHaversineDistance(double lat1, double lon1, double lat2, double lon2) {
        double R = 6371e3; // metres
        double phi1 = Math.toRadians(lat1);
        double phi2 = Math.toRadians(lat2);
        double deltaPhi = Math.toRadians(lat2 - lat1);
        double deltaLambda = Math.toRadians(lon2 - lon1);

        double a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
                Math.cos(phi1) * Math.cos(phi2) *
                Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    }
}
