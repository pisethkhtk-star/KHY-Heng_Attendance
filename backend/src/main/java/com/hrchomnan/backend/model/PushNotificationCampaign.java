package com.hrchomnan.backend.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "push_notification_campaigns")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PushNotificationCampaign {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String message;

    @Builder.Default
    @Column(nullable = false)
    private String type = "ANNOUNCEMENT"; // ANNOUNCEMENT, URGENT, EVENT, REMINDER, GENERAL

    @Builder.Default
    @Column(name = "target_audience", nullable = false)
    private String targetAudience = "ALL"; // ALL, DEPARTMENT, INDIVIDUAL

    @Column(name = "target_department_id")
    private UUID targetDepartmentId;

    @Column(name = "target_department_name")
    private String targetDepartmentName;

    @Column(name = "target_staff_ids", columnDefinition = "TEXT")
    private String targetStaffIds; // Comma separated staffIds if INDIVIDUAL

    @Column(name = "scheduled_at")
    private LocalDateTime scheduledAt; // null if sent immediately

    @Builder.Default
    @Column(nullable = false)
    private String status = "PENDING"; // PENDING, SENT, CANCELLED

    @Builder.Default
    @Column(name = "recipient_count")
    private Integer recipientCount = 0;

    @Column(name = "created_by")
    private String createdBy;

    @Column(name = "send_telegram")
    private Boolean sendTelegram;

    @Column(name = "sent_at")
    private LocalDateTime sentAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
