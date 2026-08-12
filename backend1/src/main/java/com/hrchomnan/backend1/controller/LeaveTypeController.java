package com.hrchomnan.backend1.controller;

import com.hrchomnan.backend1.model.LeaveType;
import com.hrchomnan.backend1.repository.LeaveTypeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/leave-types")
@RequiredArgsConstructor
public class LeaveTypeController {

    private final LeaveTypeRepository leaveTypeRepository;

    @GetMapping
    public ResponseEntity<List<LeaveType>> getAllTypes() {
        return ResponseEntity.ok(leaveTypeRepository.findAll());
    }

    @PostMapping
    public ResponseEntity<LeaveType> createType(@RequestBody LeaveType type) {
        LeaveType saved = leaveTypeRepository.save(type);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateType(@PathVariable UUID id, @RequestBody LeaveType updated) {
        Optional<LeaveType> existingOpt = leaveTypeRepository.findById(id);
        if (existingOpt.isPresent()) {
            LeaveType existing = existingOpt.get();
            existing.setNameEn(updated.getNameEn());
            existing.setNameKh(updated.getNameKh());
            existing.setCode(updated.getCode());
            existing.setMaxDays(updated.getMaxDays());
            existing.setDescription(updated.getDescription());
            return ResponseEntity.ok(leaveTypeRepository.save(existing));
        }
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Leave type not found"));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteType(@PathVariable UUID id) {
        if (leaveTypeRepository.existsById(id)) {
            leaveTypeRepository.deleteById(id);
            return ResponseEntity.ok(Map.of("message", "Leave type deleted successfully"));
        }
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Leave type not found"));
    }
}
