package com.hrchomnan.backend.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "tax_brackets")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TaxBracket {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false)
    private Integer tier; // 1, 2, 3, 4, 5

    @Column(name = "min_khr", precision = 14, scale = 2, nullable = false)
    private BigDecimal minKhr;

    @Column(name = "max_khr", precision = 14, scale = 2)
    private BigDecimal maxKhr; // null means unbounded (Tier 5)

    @Column(name = "tax_rate", precision = 5, scale = 4, nullable = false)
    private BigDecimal taxRate; // 0.00, 0.05, 0.10, 0.15, 0.20

    @Column(name = "rebate_khr", precision = 14, scale = 2)
    @Builder.Default
    private BigDecimal rebateKhr = BigDecimal.ZERO;

    @Column(name = "dependent_relief_khr", precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal dependentReliefKhr = new BigDecimal("150000.00"); // 150,000 KHR per dependent

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
