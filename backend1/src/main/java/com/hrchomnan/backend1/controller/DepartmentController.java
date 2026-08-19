package com.hrchomnan.backend1.controller;

import com.hrchomnan.backend1.model.Department;
import com.hrchomnan.backend1.model.Employee;
import com.hrchomnan.backend1.model.Position;
import com.hrchomnan.backend1.repository.DepartmentRepository;
import com.hrchomnan.backend1.repository.EmployeeRepository;
import com.hrchomnan.backend1.repository.PositionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/departments")
@RequiredArgsConstructor
public class DepartmentController {

    private final DepartmentRepository departmentRepository;
    private final PositionRepository positionRepository;
    private final EmployeeRepository employeeRepository;

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getAllDepartments() {
        List<Department> list = departmentRepository.findAll();
        list.sort(Comparator.comparing(Department::getNameEn, Comparator.nullsLast(String::compareToIgnoreCase)));

        List<Employee> allEmployees = employeeRepository.findAll();
        Map<UUID, Long> empCountByDept = allEmployees.stream()
                .filter(e -> e.getDepartmentId() != null)
                .collect(Collectors.groupingBy(Employee::getDepartmentId, Collectors.counting()));

        List<Map<String, Object>> response = list.stream().map(d -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", d.getId());
            map.put("nameEn", d.getNameEn());
            map.put("nameKh", d.getNameKh());
            map.put("description", d.getDescription());
            map.put("createdAt", d.getCreatedAt());
            map.put("updatedAt", d.getUpdatedAt());
            map.put("_count", Map.of("employees", empCountByDept.getOrDefault(d.getId(), 0L)));
            return map;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getDepartmentById(@PathVariable UUID id) {
        Optional<Department> deptOpt = departmentRepository.findById(id);
        if (deptOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Department not found"));
        }

        Department d = deptOpt.get();
        List<Position> positions = positionRepository.findAll().stream()
                .filter(p -> id.equals(p.getDepartmentId()))
                .collect(Collectors.toList());

        long empCount = employeeRepository.findAll().stream()
                .filter(e -> id.equals(e.getDepartmentId()))
                .count();

        Map<String, Object> map = new HashMap<>();
        map.put("id", d.getId());
        map.put("nameEn", d.getNameEn());
        map.put("nameKh", d.getNameKh());
        map.put("description", d.getDescription());
        map.put("createdAt", d.getCreatedAt());
        map.put("updatedAt", d.getUpdatedAt());
        map.put("positions", positions);
        map.put("_count", Map.of("employees", empCount));

        return ResponseEntity.ok(map);
    }

    @PostMapping
    public ResponseEntity<?> createDepartment(@RequestBody Department department) {
        if (department.getNameEn() == null || department.getNameKh() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "English and Khmer names are required"));
        }
        Department saved = departmentRepository.save(department);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateDepartment(@PathVariable UUID id, @RequestBody Department updated) {
        return departmentRepository.findById(id)
                .map(existing -> {
                    if (updated.getNameEn() != null) existing.setNameEn(updated.getNameEn());
                    if (updated.getNameKh() != null) existing.setNameKh(updated.getNameKh());
                    if (updated.getDescription() != null) existing.setDescription(updated.getDescription());
                    return ResponseEntity.ok(departmentRepository.save(existing));
                })
                .orElse(ResponseEntity.status(HttpStatus.NOT_FOUND).body(null));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteDepartment(@PathVariable UUID id) {
        if (departmentRepository.existsById(id)) {
            // Delete related positions first to mimic Cascade
            positionRepository.findAll().stream()
                    .filter(p -> id.equals(p.getDepartmentId()))
                    .forEach(positionRepository::delete);

            departmentRepository.deleteById(id);
            return ResponseEntity.ok(Map.of("message", "Department deleted successfully"));
        }
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Department not found"));
    }
}
