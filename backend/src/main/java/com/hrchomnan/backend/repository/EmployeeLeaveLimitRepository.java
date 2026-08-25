package com.hrchomnan.backend.repository;

import com.hrchomnan.backend.model.EmployeeLeaveLimit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface EmployeeLeaveLimitRepository extends JpaRepository<EmployeeLeaveLimit, UUID> {
    List<EmployeeLeaveLimit> findByStaffId(String staffId);
    Optional<EmployeeLeaveLimit> findByStaffIdAndLeaveCode(String staffId, String leaveCode);
}
