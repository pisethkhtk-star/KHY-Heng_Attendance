package com.hrchomnan.backend1.repository;

import com.hrchomnan.backend1.model.LeaveApprovalRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface LeaveApprovalRuleRepository extends JpaRepository<LeaveApprovalRule, UUID> {
    List<LeaveApprovalRule> findByApproverId(String approverId);
    List<LeaveApprovalRule> findByTargetStaffId(String targetStaffId);
    List<LeaveApprovalRule> findByTargetDeptId(UUID targetDeptId);
}
