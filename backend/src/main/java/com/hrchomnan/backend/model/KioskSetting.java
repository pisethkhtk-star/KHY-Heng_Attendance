package com.hrchomnan.backend.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "kiosk_settings")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class KioskSetting {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Builder.Default
    private String name = "Branch Location";

    @Builder.Default
    private Double latitude = 11.5564;

    @Builder.Default
    private Double longitude = 104.9282;

    @Builder.Default
    private Double radius = 100.0;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
