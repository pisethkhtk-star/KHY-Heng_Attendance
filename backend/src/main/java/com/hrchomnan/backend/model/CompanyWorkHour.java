package com.hrchomnan.backend.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "company_work_hours")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CompanyWorkHour {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "shift_1_start")
    @Builder.Default
    private String shift1Start = "08:00";

    @Column(name = "shift_1_end")
    @Builder.Default
    private String shift1End = "12:00";

    @Column(name = "shift_2_start")
    @Builder.Default
    private String shift2Start = "13:00";

    @Column(name = "shift_2_end")
    @Builder.Default
    private String shift2End = "17:00";

    @Column(name = "is_flexible")
    @Builder.Default
    private Boolean isFlexible = false;

    @Column(name = "late_grace_minutes")
    @Builder.Default
    private Integer lateGraceMinutes = 0;

    @Column(name = "flexible_schedule", columnDefinition = "TEXT")
    @Builder.Default
    private String flexibleSchedule = "{}";

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
