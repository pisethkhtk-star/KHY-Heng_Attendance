package com.hrchomnan.backend1.controller;

import com.hrchomnan.backend1.model.Position;
import com.hrchomnan.backend1.repository.PositionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/positions")
@RequiredArgsConstructor
public class PositionController {

    private final PositionRepository positionRepository;

    @GetMapping
    public ResponseEntity<List<Position>> getAllPositions() {
        return ResponseEntity.ok(positionRepository.findAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getPositionById(@PathVariable UUID id) {
        return positionRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.status(HttpStatus.NOT_FOUND).body(null));
    }

    @PostMapping
    public ResponseEntity<?> createPosition(@RequestBody Position position) {
        if (position.getTitleEn() == null || position.getTitleKh() == null || position.getDepartmentId() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "English title, Khmer title, and Department ID are required"));
        }
        Position saved = positionRepository.save(position);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updatePosition(@PathVariable UUID id, @RequestBody Position updated) {
        return positionRepository.findById(id)
                .map(existing -> {
                    existing.setTitleEn(updated.getTitleEn());
                    existing.setTitleKh(updated.getTitleKh());
                    existing.setDepartmentId(updated.getDepartmentId());
                    return ResponseEntity.ok(positionRepository.save(existing));
                })
                .orElse(ResponseEntity.status(HttpStatus.NOT_FOUND).body(null));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deletePosition(@PathVariable UUID id) {
        if (positionRepository.existsById(id)) {
            positionRepository.deleteById(id);
            return ResponseEntity.ok(Map.of("message", "Position deleted successfully"));
        }
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Position not found"));
    }
}
