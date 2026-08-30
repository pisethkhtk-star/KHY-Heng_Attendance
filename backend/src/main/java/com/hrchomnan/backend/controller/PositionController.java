package com.hrchomnan.backend.controller;

import com.hrchomnan.backend.model.Department;
import com.hrchomnan.backend.model.Employee;
import com.hrchomnan.backend.model.Position;
import com.hrchomnan.backend.repository.DepartmentRepository;
import com.hrchomnan.backend.repository.EmployeeRepository;
import com.hrchomnan.backend.repository.PositionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/positions")
@Transactional
@RequiredArgsConstructor
public class PositionController {

    private final PositionRepository positionRepository;
    private final DepartmentRepository departmentRepository;
    private final EmployeeRepository employeeRepository;

    @GetMapping
    @PreAuthorize("@perm.has('positions')")
    public ResponseEntity<List<Map<String, Object>>> getAllPositions() {
        List<Position> list = positionRepository.findAll();
        list.sort(Comparator.comparing(Position::getTitleEn, Comparator.nullsLast(String::compareToIgnoreCase)));

        Map<UUID, Department> deptMap = departmentRepository.findAll().stream()
                .collect(Collectors.toMap(Department::getId, d -> d, (a, b) -> a));

        Map<UUID, Long> empCountByPos = employeeRepository.findAll().stream()
                .filter(e -> e.getPositionId() != null)
                .collect(Collectors.groupingBy(Employee::getPositionId, Collectors.counting()));

        List<Map<String, Object>> response = list.stream().map(p -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", p.getId());
            map.put("titleEn", p.getTitleEn());
            map.put("titleKh", p.getTitleKh());
            map.put("departmentId", p.getDepartmentId());
            map.put("createdAt", p.getCreatedAt());
            map.put("updatedAt", p.getUpdatedAt());

            Department d = p.getDepartmentId() != null ? deptMap.get(p.getDepartmentId()) : null;
            if (d != null) {
                map.put("department", Map.of("nameEn", d.getNameEn(), "nameKh", d.getNameKh()));
            } else {
                map.put("department", null);
            }

            map.put("_count", Map.of("employees", empCountByPos.getOrDefault(p.getId(), 0L)));
            return map;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}")
    @PreAuthorize("@perm.has('positions')")
    public ResponseEntity<?> getPositionById(@PathVariable UUID id) {
        Optional<Position> posOpt = positionRepository.findById(id);
        if (posOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Position not found"));
        }

        Position p = posOpt.get();
        Map<String, Object> map = new HashMap<>();
        map.put("id", p.getId());
        map.put("titleEn", p.getTitleEn());
        map.put("titleKh", p.getTitleKh());
        map.put("departmentId", p.getDepartmentId());
        map.put("createdAt", p.getCreatedAt());
        map.put("updatedAt", p.getUpdatedAt());

        if (p.getDepartmentId() != null) {
            departmentRepository.findById(p.getDepartmentId()).ifPresent(d -> {
                map.put("department", d);
            });
        }

        long empCount = employeeRepository.findAll().stream()
                .filter(e -> id.equals(e.getPositionId()))
                .count();
        map.put("_count", Map.of("employees", empCount));

        return ResponseEntity.ok(map);
    }

    @PostMapping
    @PreAuthorize("@perm.has('add_position')")
    public ResponseEntity<?> createPosition(@RequestBody Position position) {
        if (position.getTitleEn() == null || position.getTitleKh() == null || position.getDepartmentId() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "English title, Khmer title, and Department ID are required"));
        }
        Position saved = positionRepository.save(position);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PutMapping("/{id}")
    @PreAuthorize("@perm.has('edit_position')")
    public ResponseEntity<?> updatePosition(@PathVariable UUID id, @RequestBody Position updated) {
        return positionRepository.findById(id)
                .map(existing -> {
                    if (updated.getTitleEn() != null) existing.setTitleEn(updated.getTitleEn());
                    if (updated.getTitleKh() != null) existing.setTitleKh(updated.getTitleKh());
                    if (updated.getDepartmentId() != null) existing.setDepartmentId(updated.getDepartmentId());
                    return ResponseEntity.ok(positionRepository.save(existing));
                })
                .orElse(ResponseEntity.status(HttpStatus.NOT_FOUND).body(null));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("@perm.has('delete_position')")
    public ResponseEntity<?> deletePosition(@PathVariable UUID id) {
        if (positionRepository.existsById(id)) {
            positionRepository.deleteById(id);
            return ResponseEntity.ok(Map.of("message", "Position deleted successfully"));
        }
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Position not found"));
    }
}
