package com.hrchomnan.backend.repository;

import com.hrchomnan.backend.enums.LeaveStatus;
import com.hrchomnan.backend.model.Leave;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface LeaveRepository extends JpaRepository<Leave, UUID> {
    List<Leave> findByStaffId(String staffId);
    List<Leave> findByStatus(LeaveStatus status);
    void deleteByStaffId(String staffId);
}
