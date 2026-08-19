package com.hrchomnan.backend1.controller;

import com.hrchomnan.backend1.model.LeaveType;
import com.hrchomnan.backend1.repository.LeaveTypeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/leave-types")
@RequiredArgsConstructor
@Slf4j
public class LeaveTypeController {

    private final LeaveTypeRepository leaveTypeRepository;

    @GetMapping
    public ResponseEntity<List<LeaveType>> getAllTypes() {
        List<LeaveType> list = leaveTypeRepository.findAll().stream()
                .sorted(Comparator.comparing(LeaveType::getCode, Comparator.nullsLast(String::compareToIgnoreCase)))
                .collect(Collectors.toList());
        return ResponseEntity.ok(list);
    }

    @PostMapping
    public ResponseEntity<?> createType(@RequestBody LeaveType type) {
        if (type.getNameEn() == null || type.getNameKh() == null || type.getCode() == null ||
                type.getNameEn().isBlank() || type.getNameKh().isBlank() || type.getCode().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "nameEn, nameKh, and code are required"));
        }

        String cleanCode = type.getCode().trim().toUpperCase();
        if (leaveTypeRepository.findByCode(cleanCode).isPresent()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Leave type code '" + cleanCode + "' is already in use"));
        }

        LeaveType newType = LeaveType.builder()
                .nameEn(type.getNameEn().trim())
                .nameKh(type.getNameKh().trim())
                .code(cleanCode)
                .maxDays(type.getMaxDays() != null ? type.getMaxDays() : 18.0)
                .description(type.getDescription() != null ? type.getDescription().trim() : null)
                .build();

        LeaveType saved = leaveTypeRepository.save(newType);
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "message", "Leave type created successfully",
                "data", saved
        ));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateType(@PathVariable UUID id, @RequestBody LeaveType updated) {
        if (updated.getNameEn() == null || updated.getNameKh() == null || updated.getCode() == null ||
                updated.getNameEn().isBlank() || updated.getNameKh().isBlank() || updated.getCode().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "nameEn, nameKh, and code are required"));
        }

        Optional<LeaveType> existingOpt = leaveTypeRepository.findById(id);
        if (existingOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Leave type not found"));
        }

        String cleanCode = updated.getCode().trim().toUpperCase();
        Optional<LeaveType> codeConflict = leaveTypeRepository.findByCode(cleanCode);
        if (codeConflict.isPresent() && !codeConflict.get().getId().equals(id)) {
            return ResponseEntity.badRequest().body(Map.of("message", "Leave type code '" + cleanCode + "' is already in use"));
        }

        LeaveType existing = existingOpt.get();
        existing.setNameEn(updated.getNameEn().trim());
        existing.setNameKh(updated.getNameKh().trim());
        existing.setCode(cleanCode);
        existing.setMaxDays(updated.getMaxDays() != null ? updated.getMaxDays() : 18.0);
        existing.setDescription(updated.getDescription() != null ? updated.getDescription().trim() : null);

        LeaveType saved = leaveTypeRepository.save(existing);
        return ResponseEntity.ok(Map.of(
                "message", "Leave type updated successfully",
                "data", saved
        ));
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
