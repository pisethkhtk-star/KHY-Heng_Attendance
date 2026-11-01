package com.hrchomnan.backend.service;

import com.hrchomnan.backend.model.Department;

import java.util.List;
import java.util.Map;

public interface DepartmentService {
    List<Map<String, Object>> getAllDepartments();
    Map<String, Object> getDepartmentById(Long id);
    Department createDepartment(Department department);
    Department updateDepartment(Long id, Department updated);
    void deleteDepartment(Long id);
}
