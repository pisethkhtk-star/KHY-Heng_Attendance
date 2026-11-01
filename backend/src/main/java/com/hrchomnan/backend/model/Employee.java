package com.hrchomnan.backend.model;

import com.hrchomnan.backend.enums.Role;
import com.hrchomnan.backend.enums.Status;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "employees")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Employee {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "staff_id", unique = true, nullable = false)
    private String staffId;

    @Column(name = "name_en", nullable = false)
    private String nameEn;

    @Column(name = "name_kh", nullable = false)
    private String nameKh;

    @Column(nullable = false)
    private String gender;

    @Column(name = "position_id")
    private Long positionId;

    @Column(name = "department_id")
    private Long departmentId;

    @Builder.Default
    private String branch = "";

    @Column(name = "join_date")
    private LocalDate joinDate;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private Status status = Status.Active;

    @Column(name = "shift_1_start")
    @Builder.Default
    private String shift1Start = "";

    @Column(name = "shift_1_end")
    @Builder.Default
    private String shift1End = "";

    @Column(name = "shift_2_start")
    @Builder.Default
    private String shift2Start = "";

    @Column(name = "shift_2_end")
    @Builder.Default
    private String shift2End = "";

    @Column(name = "is_flexible")
    @Builder.Default
    private Boolean isFlexible = false;

    @Column(name = "flexible_schedule", columnDefinition = "TEXT")
    @Builder.Default
    private String flexibleSchedule = "{}";

    @Builder.Default
    private String address = "";

    @Column(name = "id_card_passport")
    @Builder.Default
    private String idCardPassport = "";

    @Column(name = "photo_url", columnDefinition = "TEXT")
    private String photoUrl;

    @Column(unique = true, nullable = false)
    private String email;

    @Column(nullable = false)
    private String password;

    @Column(name = "role_id")
    private Long roleId;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(name = "user_roles",
            joinColumns = @JoinColumn(name = "user_id"),
            inverseJoinColumns = @JoinColumn(name = "role_id"))
    @Builder.Default
    private Set<RoleEntity> roles = new HashSet<>();

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private Role role = Role.Employee;

    @Column(name = "custom_permissions", columnDefinition = "TEXT")
    private String customPermissions;

    @Column(name = "can_login_web")
    @Builder.Default
    private Boolean canLoginWeb = false;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
