package com.hrchomnan.backend.repository;

import com.hrchomnan.backend.model.Employee;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface EmployeeRepository extends JpaRepository<Employee, Long> {
    Optional<Employee> findByStaffId(String staffId);
    Optional<Employee> findByEmail(String email);
    boolean existsByStaffId(String staffId);
    boolean existsByEmail(String email);
    java.util.List<Employee> findByRoleId(Long roleId);
    long countByRoleId(Long roleId);
}

