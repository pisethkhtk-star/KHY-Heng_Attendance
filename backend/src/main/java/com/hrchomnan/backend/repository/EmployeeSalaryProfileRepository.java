package com.hrchomnan.backend.repository;

import com.hrchomnan.backend.model.EmployeeSalaryProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface EmployeeSalaryProfileRepository extends JpaRepository<EmployeeSalaryProfile, UUID> {
    Optional<EmployeeSalaryProfile> findByStaffId(String staffId);
    boolean existsByStaffId(String staffId);
}
