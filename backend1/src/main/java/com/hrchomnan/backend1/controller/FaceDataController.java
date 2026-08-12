package com.hrchomnan.backend1.controller;

import com.hrchomnan.backend1.model.Employee;
import com.hrchomnan.backend1.model.EmployeeFaceData;
import com.hrchomnan.backend1.repository.EmployeeFaceDataRepository;
import com.hrchomnan.backend1.repository.EmployeeRepository;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/face")
@RequiredArgsConstructor
public class FaceDataController {

    private final EmployeeFaceDataRepository faceDataRepository;
    private final EmployeeRepository employeeRepository;

    @Data
    public static class EnrollRequest {
        private String staffId;
        private String faceDescriptor;
        private String photoUrl;
    }

    @PostMapping("/enroll")
    public ResponseEntity<?> enrollFace(@RequestBody EnrollRequest request) {
        if (request.getStaffId() == null || request.getFaceDescriptor() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Staff ID and face descriptor are required"));
        }

        Optional<Employee> empOpt = employeeRepository.findByStaffId(request.getStaffId());
        if (empOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Employee not found"));
        }

        faceDataRepository.findByStaffId(request.getStaffId()).ifPresent(faceDataRepository::delete);

        EmployeeFaceData faceData = EmployeeFaceData.builder()
                .staffId(request.getStaffId())
                .faceDescriptor(request.getFaceDescriptor())
                .photoUrl(request.getPhotoUrl())
                .build();

        EmployeeFaceData saved = faceDataRepository.save(faceData);
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "message", "Face coordinates registered successfully",
                "data", saved
        ));
    }
}
