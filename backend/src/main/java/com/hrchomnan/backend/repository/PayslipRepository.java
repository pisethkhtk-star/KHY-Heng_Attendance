package com.hrchomnan.backend.repository;

import com.hrchomnan.backend.model.Payslip;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PayslipRepository extends JpaRepository<Payslip, UUID> {
    List<Payslip> findByPayrollRunIdOrderByStaffIdAsc(UUID payrollRunId);
    Optional<Payslip> findByPayrollRunIdAndStaffId(UUID payrollRunId, String staffId);
    List<Payslip> findByStaffIdOrderByCreatedAtDesc(String staffId);
    void deleteByPayrollRunId(UUID payrollRunId);
}
