package com.hrchomnan.backend.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "notifications")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Notification {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "recipient_staff_id", nullable = false)
    private String recipientStaffId;

    @Column(name = "sender_staff_id")
    private String senderStaffId;

    @Column(name = "sender_name")
    private String senderName;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String message;

    @Column(name = "type", nullable = false)
    private String type; // LEAVE_REQUEST, LEAVE_APPROVED, LEAVE_REJECTED, LEAVE_DELETED, LEAVE_CANCELLED

    @Column(name = "target_id")
    private String targetId; // Reference e.g. leaveId

    @Builder.Default
    @Column(name = "is_read", nullable = false)
    private Boolean isRead = false;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
