package com.hrchomnan.backend.repository;

import com.hrchomnan.backend.model.Payslip;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PayslipRepository extends JpaRepository<Payslip, Long> {
    List<Payslip> findByPayrollRunIdOrderByStaffIdAsc(Long payrollRunId);
    Optional<Payslip> findByPayrollRunIdAndStaffId(Long payrollRunId, String staffId);
    List<Payslip> findByStaffIdOrderByCreatedAtDesc(String staffId);
    void deleteByPayrollRunId(Long payrollRunId);
}
