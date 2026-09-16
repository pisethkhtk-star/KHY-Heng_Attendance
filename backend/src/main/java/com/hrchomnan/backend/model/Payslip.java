package com.hrchomnan.backend.model;

import com.hrchomnan.backend.enums.ContractType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "payslips", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"payroll_run_id", "staff_id"})
}, indexes = {
        @Index(name = "idx_payslips_run", columnList = "payroll_run_id"),
        @Index(name = "idx_payslips_staff", columnList = "staff_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Payslip {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "payroll_run_id", nullable = false)
    private UUID payrollRunId;

    @Column(name = "staff_id", nullable = false)
    private String staffId;

    // Snapshot of Employee profile at run time
    @Column(name = "employee_name_en")
    private String employeeNameEn;

    @Column(name = "employee_name_kh")
    private String employeeNameKh;

    @Column(name = "department_name")
    private String departmentName;

    @Column(name = "position_title")
    private String positionTitle;

    @Enumerated(EnumType.STRING)
    @Column(name = "contract_type", length = 20)
    private ContractType contractType;

    @Column(name = "bank_name")
    private String bankName;

    @Column(name = "bank_account_number")
    private String bankAccountNumber;

    // Attendance & Working Metrics
    @Column(name = "standard_working_days")
    @Builder.Default
    private Integer standardWorkingDays = 26;

    @Column(name = "worked_days", precision = 5, scale = 2)
    @Builder.Default
    private BigDecimal workedDays = BigDecimal.ZERO;

    @Column(name = "absent_days", precision = 5, scale = 2)
    @Builder.Default
    private BigDecimal absentDays = BigDecimal.ZERO;

    @Column(name = "late_minutes")
    @Builder.Default
    private Integer lateMinutes = 0;

    @Column(name = "unpaid_leave_days", precision = 5, scale = 2)
    @Builder.Default
    private BigDecimal unpaidLeaveDays = BigDecimal.ZERO;

    @Column(name = "normal_ot_hours", precision = 6, scale = 2)
    @Builder.Default
    private BigDecimal normalOtHours = BigDecimal.ZERO;

    @Column(name = "holiday_ot_hours", precision = 6, scale = 2)
    @Builder.Default
    private BigDecimal holidayOtHours = BigDecimal.ZERO;

    // Rates
    @Column(name = "base_salary", precision = 12, scale = 2, nullable = false)
    @Builder.Default
    private BigDecimal baseSalary = BigDecimal.ZERO;

    @Column(name = "daily_rate", precision = 10, scale = 4)
    @Builder.Default
    private BigDecimal dailyRate = BigDecimal.ZERO;

    @Column(name = "hourly_rate", precision = 10, scale = 4)
    @Builder.Default
    private BigDecimal hourlyRate = BigDecimal.ZERO;

    // Gross Earnings
    @Column(name = "base_salary_payable", precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal baseSalaryPayable = BigDecimal.ZERO;

    @Column(name = "transport_allowance", precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal transportAllowance = BigDecimal.ZERO;

    @Column(name = "meal_allowance", precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal mealAllowance = BigDecimal.ZERO;

    @Column(name = "housing_allowance", precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal housingAllowance = BigDecimal.ZERO;

    @Column(name = "phone_allowance", precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal phoneAllowance = BigDecimal.ZERO;

    @Column(name = "attendance_allowance", precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal attendanceAllowance = BigDecimal.ZERO;

    @Column(name = "other_allowances", precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal otherAllowances = BigDecimal.ZERO;

    @Column(name = "normal_ot_amount", precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal normalOtAmount = BigDecimal.ZERO;

    @Column(name = "holiday_ot_amount", precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal holidayOtAmount = BigDecimal.ZERO;

    @Column(name = "bonus_amount", precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal bonusAmount = BigDecimal.ZERO;

    @Column(name = "commission_amount", precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal commissionAmount = BigDecimal.ZERO;

    @Column(name = "seniority_indemnity", precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal seniorityIndemnity = BigDecimal.ZERO;

    @Column(name = "gross_salary", precision = 12, scale = 2, nullable = false)
    @Builder.Default
    private BigDecimal grossSalary = BigDecimal.ZERO;

    // Deductions
    @Column(name = "late_deduction_amount", precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal lateDeductionAmount = BigDecimal.ZERO;

    @Column(name = "unpaid_leave_deduction_amount", precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal unpaidLeaveDeductionAmount = BigDecimal.ZERO;

    @Column(name = "nssf_employee_amount", precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal nssfEmployeeAmount = BigDecimal.ZERO;

    @Column(name = "nssf_employee_khr", precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal nssfEmployeeKhr = BigDecimal.ZERO;

    @Column(name = "nssf_employer_amount", precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal nssfEmployerAmount = BigDecimal.ZERO;

    @Column(name = "nssf_employer_khr", precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal nssfEmployerKhr = BigDecimal.ZERO;

    @Column(name = "taxable_salary_khr", precision = 14, scale = 2)
    @Builder.Default
    private BigDecimal taxableSalaryKhr = BigDecimal.ZERO;

    @Column(name = "tax_on_salary_amount", precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal taxOnSalaryAmount = BigDecimal.ZERO;

    @Column(name = "tax_on_salary_khr", precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal taxOnSalaryKhr = BigDecimal.ZERO;

    @Column(name = "advance_deduction", precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal advanceDeduction = BigDecimal.ZERO;

    @Column(name = "other_deductions", precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal otherDeductions = BigDecimal.ZERO;

    @Column(name = "total_deductions", precision = 12, scale = 2, nullable = false)
    @Builder.Default
    private BigDecimal totalDeductions = BigDecimal.ZERO;

    // Net Result
    @Column(name = "net_salary", precision = 12, scale = 2, nullable = false)
    @Builder.Default
    private BigDecimal netSalary = BigDecimal.ZERO;

    @Column(name = "net_salary_khr", precision = 14, scale = 2)
    @Builder.Default
    private BigDecimal netSalaryKhr = BigDecimal.ZERO;

    @Column(name = "is_paid")
    @Builder.Default
    private Boolean isPaid = false;

    @Column(columnDefinition = "TEXT")
    private String remarks;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
