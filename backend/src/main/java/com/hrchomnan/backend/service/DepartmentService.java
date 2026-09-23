package com.hrchomnan.backend.service;

import com.hrchomnan.backend.model.Department;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public interface DepartmentService {
    List<Map<String, Object>> getAllDepartments();
    Map<String, Object> getDepartmentById(UUID id);
    Department createDepartment(Department department);
    Department updateDepartment(UUID id, Department updated);
    void deleteDepartment(UUID id);
}
