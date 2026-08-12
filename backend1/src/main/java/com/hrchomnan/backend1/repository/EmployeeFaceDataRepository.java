package com.hrchomnan.backend1.repository;

import com.hrchomnan.backend1.model.EmployeeFaceData;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface EmployeeFaceDataRepository extends JpaRepository<EmployeeFaceData, UUID> {
    Optional<EmployeeFaceData> findByStaffId(String staffId);
    void deleteByStaffId(String staffId);
}
