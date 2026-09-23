package com.hrchomnan.backend.service.impl;

import com.hrchomnan.backend.exception.BadRequestException;
import com.hrchomnan.backend.exception.ResourceNotFoundException;
import com.hrchomnan.backend.model.Department;
import com.hrchomnan.backend.model.Employee;
import com.hrchomnan.backend.model.Position;
import com.hrchomnan.backend.repository.DepartmentRepository;
import com.hrchomnan.backend.repository.EmployeeRepository;
import com.hrchomnan.backend.repository.PositionRepository;
import com.hrchomnan.backend.service.DepartmentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class DepartmentServiceImpl implements DepartmentService {

    private final DepartmentRepository departmentRepository;
    private final PositionRepository positionRepository;
    private final EmployeeRepository employeeRepository;

    @Override
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getAllDepartments() {
        List<Department> list = departmentRepository.findAll();
        list.sort(Comparator.comparing(Department::getNameEn, Comparator.nullsLast(String::compareToIgnoreCase)));

        List<Employee> allEmployees = employeeRepository.findAll();
        Map<UUID, Long> empCountByDept = allEmployees.stream()
                .filter(e -> e.getDepartmentId() != null)
                .collect(Collectors.groupingBy(Employee::getDepartmentId, Collectors.counting()));

        return list.stream().map(d -> {
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
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> getDepartmentById(UUID id) {
        Department d = departmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Department", "id", id));

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

        return map;
    }

    @Override
    @Transactional
    public Department createDepartment(Department department) {
        if (department.getNameEn() == null || department.getNameKh() == null) {
            throw new BadRequestException("English and Khmer names are required");
        }
        return departmentRepository.save(department);
    }

    @Override
    @Transactional
    public Department updateDepartment(UUID id, Department updated) {
        Department existing = departmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Department", "id", id));

        if (updated.getNameEn() != null) existing.setNameEn(updated.getNameEn());
        if (updated.getNameKh() != null) existing.setNameKh(updated.getNameKh());
        if (updated.getDescription() != null) existing.setDescription(updated.getDescription());

        return departmentRepository.save(existing);
    }

    @Override
    @Transactional
    public void deleteDepartment(UUID id) {
        if (!departmentRepository.existsById(id)) {
            throw new ResourceNotFoundException("Department", "id", id);
        }

        List<Position> positions = positionRepository.findAll().stream()
                .filter(p -> id.equals(p.getDepartmentId()))
                .collect(Collectors.toList());
        positionRepository.deleteAll(positions);

        employeeRepository.findAll().stream()
                .filter(e -> id.equals(e.getDepartmentId()))
                .forEach(e -> {
                    e.setDepartmentId(null);
                    e.setPositionId(null);
                    employeeRepository.save(e);
                });

        departmentRepository.deleteById(id);
    }
}
