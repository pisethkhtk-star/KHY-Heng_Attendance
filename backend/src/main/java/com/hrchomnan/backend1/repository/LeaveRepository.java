package com.hrchomnan.backend1.repository;

import com.hrchomnan.backend1.enums.LeaveStatus;
import com.hrchomnan.backend1.model.Leave;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface LeaveRepository extends JpaRepository<Leave, UUID> {
    List<Leave> findByStaffId(String staffId);
    List<Leave> findByStatus(LeaveStatus status);
}
