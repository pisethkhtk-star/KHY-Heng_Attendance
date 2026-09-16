package com.hrchomnan.backend.model;

import com.hrchomnan.backend.enums.ContractType;
import com.hrchomnan.backend.enums.MaritalStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "employee_salary_profiles", indexes = {
        @Index(name = "idx_emp_salary_staff_id", columnList = "staff_id", unique = true)
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EmployeeSalaryProfile {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "staff_id", nullable = false, unique = true)
    private String staffId;

    @Column(name = "base_salary", precision = 12, scale = 2, nullable = false)
    @Builder.Default
    private BigDecimal baseSalary = BigDecimal.ZERO;

    @Column(name = "salary_currency", length = 10, nullable = false)
    @Builder.Default
    private String salaryCurrency = "USD";

    @Enumerated(EnumType.STRING)
    @Column(name = "contract_type", length = 20, nullable = false)
    @Builder.Default
    private ContractType contractType = ContractType.UDC;

    @Column(name = "bank_name", length = 100)
    @Builder.Default
    private String bankName = "ABA Bank";

    @Column(name = "bank_account_number", length = 100)
    @Builder.Default
    private String bankAccountNumber = "";

    @Column(name = "bank_account_name", length = 150)
    @Builder.Default
    private String bankAccountName = "";

    @Enumerated(EnumType.STRING)
    @Column(name = "marital_status", length = 20)
    @Builder.Default
    private MaritalStatus maritalStatus = MaritalStatus.Single;

    @Column(name = "spouse_allowance_eligible")
    @Builder.Default
    private Boolean spouseAllowanceEligible = false;

    @Column(name = "dependent_children_count")
    @Builder.Default
    private Integer dependentChildrenCount = 0;

    @Column(name = "has_nssf")
    @Builder.Default
    private Boolean hasNssf = true;

    // Fixed Allowances (Monthly)
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

    @Column(columnDefinition = "TEXT")
    private String note;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
