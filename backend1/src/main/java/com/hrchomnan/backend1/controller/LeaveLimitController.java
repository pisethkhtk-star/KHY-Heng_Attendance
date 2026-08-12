package com.hrchomnan.backend1.controller;

import com.hrchomnan.backend1.model.EmployeeLeaveLimit;
import com.hrchomnan.backend1.repository.EmployeeLeaveLimitRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/employee-leave-limits")
@RequiredArgsConstructor
public class LeaveLimitController {

    private final EmployeeLeaveLimitRepository leaveLimitRepository;

    @GetMapping
    public ResponseEntity<List<EmployeeLeaveLimit>> getAllLimits(@RequestParam(required = false) String staffId) {
        if (staffId != null) {
            return ResponseEntity.ok(leaveLimitRepository.findByStaffId(staffId));
        }
        return ResponseEntity.ok(leaveLimitRepository.findAll());
    }

    @PostMapping
    public ResponseEntity<EmployeeLeaveLimit> createLimit(@RequestBody EmployeeLeaveLimit limit) {
        return ResponseEntity.status(HttpStatus.CREATED).body(leaveLimitRepository.save(limit));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateLimit(@PathVariable UUID id, @RequestBody EmployeeLeaveLimit updated) {
        Optional<EmployeeLeaveLimit> existingOpt = leaveLimitRepository.findById(id);
        if (existingOpt.isPresent()) {
            EmployeeLeaveLimit existing = existingOpt.get();
            existing.setMaxDays(updated.getMaxDays());
            return ResponseEntity.ok(leaveLimitRepository.save(existing));
        }
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Limit not found"));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteLimit(@PathVariable UUID id) {
        if (leaveLimitRepository.existsById(id)) {
            leaveLimitRepository.deleteById(id);
            return ResponseEntity.ok(Map.of("message", "Limit deleted successfully"));
        }
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Limit not found"));
    }
}
