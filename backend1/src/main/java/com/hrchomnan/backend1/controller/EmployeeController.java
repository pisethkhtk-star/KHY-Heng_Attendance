package com.hrchomnan.backend1.controller;

import com.hrchomnan.backend1.model.Employee;
import com.hrchomnan.backend1.repository.EmployeeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/employees")
@RequiredArgsConstructor
public class EmployeeController {

    private final EmployeeRepository employeeRepository;

    @GetMapping
    public ResponseEntity<List<Employee>> getAllEmployees() {
        return ResponseEntity.ok(employeeRepository.findAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Employee> getEmployeeById(@PathVariable UUID id) {
        return employeeRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/staff/{staffId}")
    public ResponseEntity<Employee> getEmployeeByStaffId(@PathVariable String staffId) {
        return employeeRepository.findByStaffId(staffId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<Employee> createEmployee(@RequestBody Employee employee) {
        Employee saved = employeeRepository.save(employee);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Employee> updateEmployee(@PathVariable UUID id, @RequestBody Employee updated) {
        return employeeRepository.findById(id)
                .map(existing -> {
                    existing.setNameEn(updated.getNameEn());
                    existing.setNameKh(updated.getNameKh());
                    existing.setGender(updated.getGender());
                    existing.setDepartmentId(updated.getDepartmentId());
                    existing.setPositionId(updated.getPositionId());
                    existing.setBranch(updated.getBranch());
                    existing.setStatus(updated.getStatus());
                    existing.setEmail(updated.getEmail());
                    existing.setRole(updated.getRole());
                    return ResponseEntity.ok(employeeRepository.save(existing));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteEmployee(@PathVariable UUID id) {
        if (employeeRepository.existsById(id)) {
            employeeRepository.deleteById(id);
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }
}
