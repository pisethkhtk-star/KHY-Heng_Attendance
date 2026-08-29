package com.hrchomnan.backend.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hrchomnan.backend.enums.Status;
import com.hrchomnan.backend.model.AttendanceLog;
import com.hrchomnan.backend.model.Department;
import com.hrchomnan.backend.model.Employee;
import com.hrchomnan.backend.model.EmployeeFaceData;
import com.hrchomnan.backend.model.KioskSetting;
import com.hrchomnan.backend.repository.AttendanceLogRepository;
import com.hrchomnan.backend.repository.DepartmentRepository;
import com.hrchomnan.backend.repository.EmployeeFaceDataRepository;
import com.hrchomnan.backend.repository.EmployeeRepository;
import com.hrchomnan.backend.repository.KioskSettingRepository;
import com.hrchomnan.backend.util.AttendanceHelper;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/face")
@RequiredArgsConstructor
@Slf4j
public class FaceDataController {

    private final EmployeeFaceDataRepository faceDataRepository;
    private final EmployeeRepository employeeRepository;
    private final AttendanceLogRepository attendanceLogRepository;
    private final KioskSettingRepository kioskSettingRepository;
    private final DepartmentRepository departmentRepository;
    private final AttendanceHelper attendanceHelper;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Data
    public static class EnrollRequest {
        private String staffId;
        private Object faceDescriptor; // String or List<Double>
        private String photoUrl;
    }

    @PostMapping("/enroll")
    public ResponseEntity<?> enrollFace(@RequestBody EnrollRequest request) {
        if (request.getStaffId() == null || request.getFaceDescriptor() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Staff ID and face descriptor are required"));
        }

        Optional<Employee> empOpt = employeeRepository.findByStaffId(request.getStaffId());
        if (empOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Employee not found with ID: " + request.getStaffId()));
        }

        String descriptorStr;
        try {
            if (request.getFaceDescriptor() instanceof String str) {
                descriptorStr = str;
            } else {
                descriptorStr = objectMapper.writeValueAsString(request.getFaceDescriptor());
            }
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", "Invalid face descriptor format"));
        }

        try {
            List<EmployeeFaceData> existingList = faceDataRepository.findAllByStaffId(request.getStaffId());
            if (!existingList.isEmpty()) {
                faceDataRepository.deleteAll(existingList);
            }

            EmployeeFaceData faceData = EmployeeFaceData.builder()
                    .staffId(request.getStaffId())
                    .faceDescriptor(descriptorStr)
                    .photoUrl(request.getPhotoUrl())
                    .build();

            EmployeeFaceData saved = faceDataRepository.save(faceData);

            return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                    "message", "Face coordinates registered successfully",
                    "data", saved
            ));
        } catch (Exception e) {
            log.error("Error during face enrollment for {}: ", request.getStaffId(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
                    "message", "Face enrollment failed: " + e.getMessage()
            ));
        }
    }

    @GetMapping("/all")
    public ResponseEntity<?> getAllFaceData() {
        List<EmployeeFaceData> list = faceDataRepository.findAll();
        Map<String, Employee> empMap = new HashMap<>();
        for (Employee emp : employeeRepository.findAll()) {
            if (emp.getStaffId() != null && emp.getStatus() == Status.Active) {
                empMap.put(emp.getStaffId(), emp);
            }
        }

        List<Map<String, Object>> result = new ArrayList<>();
        for (EmployeeFaceData f : list) {
            if (f.getStaffId() == null || f.getFaceDescriptor() == null) continue;
            Employee emp = empMap.get(f.getStaffId());
            if (emp == null) continue; // Only return active employees

            Map<String, Object> item = new HashMap<>();
            item.put("staffId", f.getStaffId());
            item.put("nameEn", emp.getNameEn());
            item.put("nameKh", emp.getNameKh());
            item.put("photoUrl", f.getPhotoUrl());
            try {
                List<Double> desc = objectMapper.readValue(f.getFaceDescriptor(), new TypeReference<List<Double>>() {});
                item.put("descriptor", desc);
            } catch (Exception e) {
                item.put("descriptor", f.getFaceDescriptor());
            }
            result.add(item);
        }

        return ResponseEntity.ok(result);
    }

    @GetMapping("/{staffId}")
    public ResponseEntity<?> getFaceData(@PathVariable String staffId) {
        List<EmployeeFaceData> list = faceDataRepository.findAllByStaffId(staffId);
        if (!list.isEmpty()) {
            return ResponseEntity.ok(list.get(0));
        }
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(null);
    }

    @DeleteMapping("/{staffId}")
    public ResponseEntity<?> deleteFaceData(@PathVariable String staffId) {
        List<EmployeeFaceData> list = faceDataRepository.findAllByStaffId(staffId);
        if (!list.isEmpty()) {
            faceDataRepository.deleteAll(list);
            return ResponseEntity.ok(Map.of("message", "Face data deleted successfully"));
        }
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Face data not found"));
    }

    @Data
    public static class FaceCheckInRequest {
        private String staffId;
        private Object faceDescriptor;
        private String deviceInfo;
        private String location;
        private Double latitude;
        private Double longitude;
        private String note;
        private String action;
    }

    @PostMapping("/checkin")
    public ResponseEntity<?> verifyAndCheckInFace(@RequestBody FaceCheckInRequest request) {
        Employee employee = null;

        // 1. If client already matched the face locally using preloaded descriptors:
        if (request.getStaffId() != null && !request.getStaffId().isBlank()) {
            Optional<Employee> empOpt = employeeRepository.findByStaffId(request.getStaffId().trim());
            if (empOpt.isPresent() && empOpt.get().getStatus() == Status.Active) {
                employee = empOpt.get();
            } else {
                return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Employee not found or inactive"));
            }
        } else {
            // Fallback to server-side descriptor comparison
            if (request.getFaceDescriptor() == null) {
                return ResponseEntity.badRequest().body(Map.of("message", "Staff ID or valid face descriptor array is required"));
            }

            List<Double> inputDescriptor;
            try {
                if (request.getFaceDescriptor() instanceof List<?> list) {
                    inputDescriptor = new ArrayList<>();
                    for (Object item : list) {
                        if (item instanceof Number n) {
                            inputDescriptor.add(n.doubleValue());
                        }
                    }
                } else if (request.getFaceDescriptor() instanceof String str) {
                    inputDescriptor = objectMapper.readValue(str, new TypeReference<List<Double>>() {});
                } else {
                    return ResponseEntity.badRequest().body(Map.of("message", "Valid face descriptor array is required"));
                }
            } catch (Exception e) {
                return ResponseEntity.badRequest().body(Map.of("message", "Valid face descriptor array is required"));
            }

            List<EmployeeFaceData> enrolledFaces = faceDataRepository.findAll();
            EmployeeFaceData bestMatch = null;
            double minDistance = 1.0;

            for (EmployeeFaceData record : enrolledFaces) {
                Optional<Employee> empOpt = employeeRepository.findByStaffId(record.getStaffId());
                if (empOpt.isEmpty() || empOpt.get().getStatus() != Status.Active) continue;

                try {
                    List<Double> enrolledDescriptor = objectMapper.readValue(record.getFaceDescriptor(), new TypeReference<List<Double>>() {});
                    double dist = getEuclideanDistance(inputDescriptor, enrolledDescriptor);
                    if (dist < minDistance) {
                        minDistance = dist;
                        bestMatch = record;
                    }
                } catch (Exception ignored) {}
            }

            double RECOGNITION_THRESHOLD = 0.55;
            if (bestMatch == null || minDistance > RECOGNITION_THRESHOLD) {
                attendanceLogRepository.save(AttendanceLog.builder()
                        .method("face")
                        .action("UNKNOWN")
                        .status("failed")
                        .deviceInfo(request.getDeviceInfo() != null ? request.getDeviceInfo() : "Kiosk Camera")
                        .location(request.getLocation() != null ? request.getLocation() : "HQ Entrance")
                        .build());

                return ResponseEntity.badRequest().body(Map.of(
                        "success", false,
                        "message", "Face not recognized",
                        "distance", minDistance
                ));
            }

            Optional<Employee> empOpt = employeeRepository.findByStaffId(bestMatch.getStaffId());
            if (empOpt.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Employee not found"));
            }
            employee = empOpt.get();
        }

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

            List<KioskSetting> allowedSettings = settingsList.stream()
                    .filter(s -> employeeBranches.contains(s.getName().trim().toLowerCase()))
                    .toList();

            if (allowedSettings.isEmpty() && !employeeBranches.isEmpty()) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                        "success", false,
                        "message", "គណនីរបស់អ្នកមិនទាន់ត្រូវបានកំណត់ឱ្យចុះវត្តមាននៅសាខាណាមួយឡើយ! (Employee is not assigned to any active branch settings)."
                ));
            }

            List<KioskSetting> checkList = allowedSettings.isEmpty() ? settingsList : allowedSettings;
            boolean isInsideAnyZone = false;
            String closestZoneName = null;
            double closestDistance = Double.MAX_VALUE;
            double closestRadius = 100.0;

            for (KioskSetting ks : checkList) {
                double d = getHaversineDistance(clientLat, clientLng, ks.getLatitude(), ks.getLongitude());
                if (d <= ks.getRadius()) {
                    isInsideAnyZone = true;
                    break;
                }
                if (d < closestDistance) {
                    closestDistance = d;
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

        // 2. Perform attendance scanning update via AttendanceHelper
        AttendanceHelper.ScanResult result = attendanceHelper.processAttendanceScan(
                employee.getStaffId(),
                request.getAction(),
                null,
                null,
                request.getNote() != null && !request.getNote().isBlank() ? request.getNote() : "Auto scan: Face Recognition"
        );

        // 3. Create successful audit trail log
        attendanceLogRepository.save(AttendanceLog.builder()
                .staffId(employee.getStaffId())
                .method("face")
                .action(result.getAction())
                .status("success")
                .deviceInfo(request.getDeviceInfo() != null ? request.getDeviceInfo() : "Kiosk Camera")
                .location(request.getLocation() != null ? request.getLocation() : "HQ Entrance")
                .build());

        String deptName = "N/A";
        if (employee.getDepartmentId() != null) {
            Optional<Department> dOpt = departmentRepository.findById(employee.getDepartmentId());
            if (dOpt.isPresent()) deptName = dOpt.get().getNameEn();
        }

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Recognized! Scanned: " + result.getAction(),
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

    private double getEuclideanDistance(List<Double> v1, List<Double> v2) {
        if (v1 == null || v2 == null || v1.size() != v2.size()) return Double.MAX_VALUE;
        double sum = 0.0;
        for (int i = 0; i < v1.size(); i++) {
            double diff = v1.get(i) - v2.get(i);
            sum += diff * diff;
        }
        return Math.sqrt(sum);
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
