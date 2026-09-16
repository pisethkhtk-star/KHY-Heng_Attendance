package com.hrchomnan.backend.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "nssf_configs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NssfConfig {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "employee_rate", precision = 5, scale = 4, nullable = false)
    @Builder.Default
    private BigDecimal employeeRate = new BigDecimal("0.02"); // 2%

    @Column(name = "employer_rate", precision = 5, scale = 4, nullable = false)
    @Builder.Default
    private BigDecimal employerRate = new BigDecimal("0.02"); // 2%

    @Column(name = "max_wage_ceiling_khr", precision = 12, scale = 2, nullable = false)
    @Builder.Default
    private BigDecimal maxWageCeilingKhr = new BigDecimal("1200000.00"); // 1,200,000 KHR

    @Column(name = "default_exchange_rate_khr", precision = 8, scale = 2, nullable = false)
    @Builder.Default
    private BigDecimal defaultExchangeRateKhr = new BigDecimal("4100.00"); // 4,100 KHR per USD

    @Column(name = "is_tax_enabled")
    @Builder.Default
    private Boolean isTaxEnabled = true;

    @Column(name = "is_active")
    @Builder.Default
    private Boolean isActive = true;

    public Boolean getIsTaxEnabled() {
        return isTaxEnabled == null || isTaxEnabled;
    }

    public void setIsTaxEnabled(Boolean isTaxEnabled) {
        this.isTaxEnabled = isTaxEnabled;
    }

    @Column(name = "effective_date")
    private LocalDate effectiveDate;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
