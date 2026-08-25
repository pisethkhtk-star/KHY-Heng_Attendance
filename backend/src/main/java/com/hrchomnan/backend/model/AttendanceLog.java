package com.hrchomnan.backend.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "attendance_logs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AttendanceLog {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "staff_id")
    private String staffId;

    @Column(nullable = false)
    private String method; // 'face', 'qrcode', 'manual'

    @Column(nullable = false)
    private String action; // 'checkin_1', 'checkout_1', 'checkin_2', 'checkout_2'

    @Column(name = "captured_at")
    @CreationTimestamp
    private LocalDateTime capturedAt;

    @Column(name = "device_info")
    private String deviceInfo;

    private String location;

    @Column(name = "photo_snapshot_url")
    private String photoSnapshotUrl;

    @Column(nullable = false)
    private String status; // 'success', 'failed'

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
