package com.hrchomnan.backend.repository;

import com.hrchomnan.backend.model.EmployeeFaceData;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EmployeeFaceDataRepository extends JpaRepository<EmployeeFaceData, Long> {
    List<EmployeeFaceData> findAllByStaffId(String staffId);
    Optional<EmployeeFaceData> findByStaffId(String staffId);
    void deleteByStaffId(String staffId);
}
