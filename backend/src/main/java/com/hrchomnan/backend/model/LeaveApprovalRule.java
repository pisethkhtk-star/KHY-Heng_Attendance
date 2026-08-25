package com.hrchomnan.backend.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "leave_approval_rules")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LeaveApprovalRule {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "approver_id", nullable = false)
    private String approverId;

    @Builder.Default
    private String scope = "Employee"; // "Department" or "Employee"

    @Column(name = "target_dept_id")
    private UUID targetDeptId;

    @Column(name = "target_staff_id")
    private String targetStaffId;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
