package com.hrchomnan.backend.model;

import com.hrchomnan.backend.enums.LeaveStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "overtimes", indexes = {
        @Index(name = "idx_overtimes_staff_id", columnList = "staff_id"),
        @Index(name = "idx_overtimes_manager_id", columnList = "manager_id"),
        @Index(name = "idx_overtimes_from_date", columnList = "from_date"),
        @Index(name = "idx_overtimes_to_date", columnList = "to_date")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Overtime {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "staff_id", nullable = false)
    private String staffId;

    @Column(name = "manager_id")
    private String managerId;

    @Column(name = "manager_name")
    private String managerName;

    @Column(name = "branch_id")
    private UUID branchId;

    @Builder.Default
    @Column(name = "branch")
    private String branch = "";

    @Column(name = "from_date", nullable = false)
    private LocalDate fromDate;

    @Column(name = "to_date", nullable = false)
    private LocalDate toDate;

    @Column(name = "start_time", nullable = false)
    private String startTime;

    @Column(name = "end_time", nullable = false)
    private String endTime;

    @Builder.Default
    @Column(name = "amount_day", precision = 5, scale = 2)
    private BigDecimal amountDay = BigDecimal.ZERO;

    @Column(columnDefinition = "TEXT")
    private String reason;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private LeaveStatus status = LeaveStatus.Pending;

    @Column(columnDefinition = "TEXT")
    private String comment;

    @CreationTimestamp
    @Column(name = "requested_at")
    private LocalDateTime requestedAt;

    @Column(name = "approved_at")
    private LocalDateTime approvedAt;

    @Column(name = "created_by")
    private String createdBy;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
