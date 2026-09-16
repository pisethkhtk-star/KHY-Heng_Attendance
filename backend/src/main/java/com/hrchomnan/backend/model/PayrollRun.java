package com.hrchomnan.backend.model;

import com.hrchomnan.backend.enums.PayrollStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "payroll_runs", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"month", "year"})
}, indexes = {
        @Index(name = "idx_payroll_runs_my", columnList = "month, year")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PayrollRun {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false)
    private Integer month; // 1 - 12

    @Column(nullable = false)
    private Integer year;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    @Column(nullable = false)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    @Builder.Default
    private PayrollStatus status = PayrollStatus.Draft;

    @Column(name = "standard_working_days")
    @Builder.Default
    private Integer standardWorkingDays = 26;

    @Column(name = "exchange_rate_khr", precision = 8, scale = 2)
    @Builder.Default
    private BigDecimal exchangeRateKhr = new BigDecimal("4100.00");

    @Column(name = "total_employees")
    @Builder.Default
    private Integer totalEmployees = 0;

    @Column(name = "total_gross", precision = 14, scale = 2)
    @Builder.Default
    private BigDecimal totalGross = BigDecimal.ZERO;

    @Column(name = "total_deductions", precision = 14, scale = 2)
    @Builder.Default
    private BigDecimal totalDeductions = BigDecimal.ZERO;

    @Column(name = "total_net", precision = 14, scale = 2)
    @Builder.Default
    private BigDecimal totalNet = BigDecimal.ZERO;

    @Column(name = "total_nssf_employee", precision = 14, scale = 2)
    @Builder.Default
    private BigDecimal totalNssfEmployee = BigDecimal.ZERO;

    @Column(name = "total_nssf_employer", precision = 14, scale = 2)
    @Builder.Default
    private BigDecimal totalNssfEmployer = BigDecimal.ZERO;

    @Column(name = "total_tax", precision = 14, scale = 2)
    @Builder.Default
    private BigDecimal totalTax = BigDecimal.ZERO;

    @Column(name = "created_by")
    private String createdBy;

    @Column(name = "approved_by")
    private String approvedBy;

    @Column(name = "approved_at")
    private LocalDateTime approvedAt;

    @Column(name = "paid_at")
    private LocalDateTime paidAt;

    @Column(columnDefinition = "TEXT")
    private String note;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
