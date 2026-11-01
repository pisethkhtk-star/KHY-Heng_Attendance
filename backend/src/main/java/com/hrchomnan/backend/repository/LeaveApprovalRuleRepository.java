package com.hrchomnan.backend.repository;

import com.hrchomnan.backend.model.LeaveApprovalRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LeaveApprovalRuleRepository extends JpaRepository<LeaveApprovalRule, Long> {
    List<LeaveApprovalRule> findByApproverId(String approverId);
    List<LeaveApprovalRule> findByTargetStaffId(String targetStaffId);
    List<LeaveApprovalRule> findByTargetDeptId(Long targetDeptId);
    List<LeaveApprovalRule> findByRuleType(String ruleType);
    List<LeaveApprovalRule> findByTargetStaffIdAndRuleType(String targetStaffId, String ruleType);
    List<LeaveApprovalRule> findByTargetDeptIdAndRuleType(Long targetDeptId, String ruleType);
    void deleteByApproverId(String approverId);
    void deleteByTargetStaffId(String targetStaffId);
}
