package com.hrchomnan.backend.repository;

import com.hrchomnan.backend.model.Employee;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface EmployeeRepository extends JpaRepository<Employee, UUID> {
    Optional<Employee> findByStaffId(String staffId);
    Optional<Employee> findByEmail(String email);
}
