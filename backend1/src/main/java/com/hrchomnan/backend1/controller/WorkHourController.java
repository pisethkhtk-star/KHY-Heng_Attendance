package com.hrchomnan.backend1.controller;

import com.hrchomnan.backend1.model.CompanyWorkHour;
import com.hrchomnan.backend1.repository.CompanyWorkHourRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/company-work-hours")
@RequiredArgsConstructor
public class WorkHourController {

    private final CompanyWorkHourRepository workHourRepository;

    @GetMapping
    public ResponseEntity<List<CompanyWorkHour>> getWorkHours() {
        return ResponseEntity.ok(workHourRepository.findAll());
    }

    @PostMapping
    public ResponseEntity<CompanyWorkHour> createOrUpdateWorkHour(@RequestBody CompanyWorkHour workHour) {
        List<CompanyWorkHour> list = workHourRepository.findAll();
        if (!list.isEmpty()) {
            CompanyWorkHour existing = list.get(0);
            if (workHour.getShift1Start() != null) existing.setShift1Start(workHour.getShift1Start());
            if (workHour.getShift1End() != null) existing.setShift1End(workHour.getShift1End());
            if (workHour.getShift2Start() != null) existing.setShift2Start(workHour.getShift2Start());
            if (workHour.getShift2End() != null) existing.setShift2End(workHour.getShift2End());
            return ResponseEntity.ok(workHourRepository.save(existing));
        }
        return ResponseEntity.ok(workHourRepository.save(workHour));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateWorkHour(@PathVariable UUID id, @RequestBody CompanyWorkHour updated) {
        Optional<CompanyWorkHour> existingOpt = workHourRepository.findById(id);
        if (existingOpt.isPresent()) {
            CompanyWorkHour existing = existingOpt.get();
            if (updated.getShift1Start() != null) existing.setShift1Start(updated.getShift1Start());
            if (updated.getShift1End() != null) existing.setShift1End(updated.getShift1End());
            if (updated.getShift2Start() != null) existing.setShift2Start(updated.getShift2Start());
            if (updated.getShift2End() != null) existing.setShift2End(updated.getShift2End());
            return ResponseEntity.ok(workHourRepository.save(existing));
        }
        return ResponseEntity.status(404).body(Map.of("message", "Work hours not found"));
    }
}
