package com.hrchomnan.backend.service.impl;

import com.hrchomnan.backend.exception.BadRequestException;
import com.hrchomnan.backend.exception.ResourceNotFoundException;
import com.hrchomnan.backend.model.Department;
import com.hrchomnan.backend.model.Employee;
import com.hrchomnan.backend.model.Position;
import com.hrchomnan.backend.repository.DepartmentRepository;
import com.hrchomnan.backend.repository.EmployeeRepository;
import com.hrchomnan.backend.repository.PositionRepository;
import com.hrchomnan.backend.service.PositionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class PositionServiceImpl implements PositionService {

    private final PositionRepository positionRepository;
    private final DepartmentRepository departmentRepository;
    private final EmployeeRepository employeeRepository;

    @Override
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getAllPositions() {
        List<Position> list = positionRepository.findAll();
        list.sort(Comparator.comparing(Position::getTitleEn, Comparator.nullsLast(String::compareToIgnoreCase)));

        Map<UUID, Department> deptMap = departmentRepository.findAll().stream()
                .collect(Collectors.toMap(Department::getId, d -> d, (a, b) -> a));

        Map<UUID, Long> empCountByPos = employeeRepository.findAll().stream()
                .filter(e -> e.getPositionId() != null)
                .collect(Collectors.groupingBy(Employee::getPositionId, Collectors.counting()));

        return list.stream().map(p -> {
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
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> getPositionById(UUID id) {
        Position p = positionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Position", "id", id));

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

        return map;
    }

    @Override
    @Transactional
    public Position createPosition(Position position) {
        if (position.getTitleEn() == null || position.getTitleKh() == null || position.getDepartmentId() == null) {
            throw new BadRequestException("English title, Khmer title, and Department ID are required");
        }
        return positionRepository.save(position);
    }

    @Override
    @Transactional
    public Position updatePosition(UUID id, Position updated) {
        Position existing = positionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Position", "id", id));

        if (updated.getTitleEn() != null) existing.setTitleEn(updated.getTitleEn());
        if (updated.getTitleKh() != null) existing.setTitleKh(updated.getTitleKh());
        if (updated.getDepartmentId() != null) existing.setDepartmentId(updated.getDepartmentId());

        return positionRepository.save(existing);
    }

    @Override
    @Transactional
    public void deletePosition(UUID id) {
        if (!positionRepository.existsById(id)) {
            throw new ResourceNotFoundException("Position", "id", id);
        }

        employeeRepository.findAll().stream()
                .filter(e -> id.equals(e.getPositionId()))
                .forEach(e -> {
                    e.setPositionId(null);
                    employeeRepository.save(e);
                });

        positionRepository.deleteById(id);
    }
}
