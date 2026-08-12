package com.hrchomnan.backend1.controller;

import com.hrchomnan.backend1.model.AttendanceLog;
import com.hrchomnan.backend1.model.Employee;
import com.hrchomnan.backend1.model.EmployeeQRCode;
import com.hrchomnan.backend1.model.KioskSetting;
import com.hrchomnan.backend1.repository.AttendanceLogRepository;
import com.hrchomnan.backend1.repository.EmployeeQRCodeRepository;
import com.hrchomnan.backend1.repository.EmployeeRepository;
import com.hrchomnan.backend1.repository.KioskSettingRepository;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/qrcode")
@RequiredArgsConstructor
public class QrCodeController {

    private final EmployeeQRCodeRepository qrCodeRepository;
    private final EmployeeRepository employeeRepository;
    private final KioskSettingRepository kioskSettingRepository;
    private final AttendanceLogRepository attendanceLogRepository;

    @GetMapping("/generate/{staffId}")
    public ResponseEntity<?> generateQRCode(@PathVariable String staffId) {
        Optional<Employee> empOpt = employeeRepository.findByStaffId(staffId);
        if (empOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Employee not found"));
        }

        String token = "QR_TOKEN_" + staffId + "_" + System.currentTimeMillis();

        EmployeeQRCode qrCode = EmployeeQRCode.builder()
                .staffId(staffId)
                .qrToken(token)
                .isActive(true)
                .build();

        qrCodeRepository.save(qrCode);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "qrToken", token
        ));
    }

    @Data
    public static class ScanRequest {
        private String qrToken;
        private String staffId;
        private String deviceInfo;
        private String location;
        private Double latitude;
        private Double longitude;
        private String action;
        private String note;
    }

    @PostMapping("/scan")
    public ResponseEntity<?> scanQRCode(@RequestBody ScanRequest request) {
        if (request.getQrToken() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "QR token is required"));
        }

        String token = request.getQrToken().trim();
        String targetStaffId = request.getStaffId();
        String action = request.getAction() != null ? request.getAction() : "checkin_1";

        if (token.startsWith("branch_qr:")) {
            String branchIdStr = token.replace("branch_qr:", "").trim();
            String branchName = "Branch HQ";
            try {
                UUID bId = UUID.fromString(branchIdStr);
                Optional<KioskSetting> settingOpt = kioskSettingRepository.findById(bId);
                if (settingOpt.isPresent()) {
                    branchName = settingOpt.get().getName();
                }
            } catch (Exception ignored) {}

            if (targetStaffId != null && !targetStaffId.trim().isEmpty()) {
                AttendanceLog log = AttendanceLog.builder()
                        .staffId(targetStaffId)
                        .method("qrcode")
                        .action(action)
                        .status("success")
                        .location(branchName)
                        .deviceInfo(request.getDeviceInfo() != null ? request.getDeviceInfo() : "Mobile App")
                        .build();
                attendanceLogRepository.save(log);
            }

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Branch QR Code scanned successfully for " + branchName,
                    "branch", branchName,
                    "action", action,
                    "staffId", targetStaffId != null ? targetStaffId : "EMP-001"
            ));
        }

        Optional<EmployeeQRCode> qrOpt = qrCodeRepository.findByQrToken(token);
        if (qrOpt.isPresent() && Boolean.TRUE.equals(qrOpt.get().getIsActive())) {
            targetStaffId = qrOpt.get().getStaffId();
        }

        if (targetStaffId != null && !targetStaffId.trim().isEmpty()) {
            AttendanceLog log = AttendanceLog.builder()
                    .staffId(targetStaffId)
                    .method("qrcode")
                    .action(action)
                    .status("success")
                    .location("HQ Office Geofence")
                    .deviceInfo(request.getDeviceInfo() != null ? request.getDeviceInfo() : "Mobile App")
                    .build();
            attendanceLogRepository.save(log);
        }

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "QR Code scanned successfully",
                "staffId", targetStaffId != null ? targetStaffId : "EMP-001",
                "action", action
        ));
    }
}
