package com.hrchomnan.backend.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "employee_leave_limits", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"staff_id", "leave_code"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EmployeeLeaveLimit {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "staff_id", nullable = false)
    private String staffId;

    @Column(name = "leave_code", nullable = false)
    private String leaveCode;

    @Column(name = "max_days", nullable = false)
    private Double maxDays;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
