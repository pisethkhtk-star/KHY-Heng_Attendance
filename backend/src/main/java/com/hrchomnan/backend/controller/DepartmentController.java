package com.hrchomnan.backend.controller;

import com.hrchomnan.backend.model.Department;
import com.hrchomnan.backend.service.DepartmentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/departments")
@RequiredArgsConstructor
@Tag(name = "Departments", description = "Department hierarchy, creation, updates and deletions")
public class DepartmentController {

    private final DepartmentService departmentService;

    @Operation(summary = "Get all departments", description = "Retrieve list of all departments with employee counts")
    @ApiResponse(responseCode = "200", description = "Departments list")
    @GetMapping
    @PreAuthorize("@perm.has('departments')")
    public ResponseEntity<List<Map<String, Object>>> getAllDepartments() {
        return ResponseEntity.ok(departmentService.getAllDepartments());
    }

    @Operation(summary = "Get department by ID", description = "Retrieve department details including attached positions")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Department found"),
            @ApiResponse(responseCode = "404", description = "Department not found")
    })
    @GetMapping("/{id}")
    @PreAuthorize("@perm.has('departments')")
    public ResponseEntity<Map<String, Object>> getDepartmentById(@PathVariable UUID id) {
        return ResponseEntity.ok(departmentService.getDepartmentById(id));
    }

    @Operation(summary = "Create department", description = "Add a new department")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Department created"),
            @ApiResponse(responseCode = "400", description = "Missing required fields")
    })
    @PostMapping
    @PreAuthorize("@perm.has('add_department')")
    public ResponseEntity<Department> createDepartment(@RequestBody Department department) {
        Department saved = departmentService.createDepartment(department);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @Operation(summary = "Update department", description = "Update details of existing department")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Department updated"),
            @ApiResponse(responseCode = "404", description = "Department not found")
    })
    @PutMapping("/{id}")
    @PreAuthorize("@perm.has('edit_department')")
    public ResponseEntity<Department> updateDepartment(@PathVariable UUID id, @RequestBody Department updated) {
        return ResponseEntity.ok(departmentService.updateDepartment(id, updated));
    }

    @Operation(summary = "Delete department", description = "Delete department and dissociate positions and employees")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Department deleted"),
            @ApiResponse(responseCode = "404", description = "Department not found")
    })
    @DeleteMapping("/{id}")
    @PreAuthorize("@perm.has('delete_department')")
    public ResponseEntity<Void> deleteDepartment(@PathVariable UUID id) {
        departmentService.deleteDepartment(id);
        return ResponseEntity.noContent().build();
    }
}
