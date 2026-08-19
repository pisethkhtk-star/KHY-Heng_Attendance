package com.hrchomnan.backend1.config;

import com.hrchomnan.backend1.enums.Role;
import com.hrchomnan.backend1.enums.Status;
import com.hrchomnan.backend1.model.*;
import com.hrchomnan.backend1.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements CommandLineRunner {

    private final RolePermissionRepository rolePermissionRepository;
    private final KioskSettingRepository kioskSettingRepository;
    private final LeaveTypeRepository leaveTypeRepository;
    private final CompanyWorkHourRepository companyWorkHourRepository;
    private final EmployeeRepository employeeRepository;
    private final DepartmentRepository departmentRepository;
    private final PositionRepository positionRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        log.info("Starting DataInitializer...");
        initializePermissions();
        initializeKioskSettings();
        initializeLeaveTypes();
        initializeWorkHours();
        initializeDemoData();
        log.info("DataInitializer completed successfully.");
    }

    private void initializePermissions() {
        record Perm(Role role, String resource, boolean canAccess) {}

        List<Perm> defaultPermissions = List.of(
                // Admin permissions
                new Perm(Role.Admin, "departments", true),
                new Perm(Role.Admin, "positions", true),
                new Perm(Role.Admin, "employees", true),
                new Perm(Role.Admin, "attendance", true),
                new Perm(Role.Admin, "add_attendance", true),
                new Perm(Role.Admin, "edit_attendance", true),
                new Perm(Role.Admin, "delete_attendance", true),
                new Perm(Role.Admin, "leaves", true),
                new Perm(Role.Admin, "overtime", true),
                new Perm(Role.Admin, "reports", true),
                new Perm(Role.Admin, "facescan", true),
                new Perm(Role.Admin, "qrscan", true),
                new Perm(Role.Admin, "kiosk_settings", true),
                new Perm(Role.Admin, "leave_types", true),
                new Perm(Role.Admin, "leave_allowances", true),
                new Perm(Role.Admin, "leave_approvals", true),
                new Perm(Role.Admin, "permissions", true),
                new Perm(Role.Admin, "work_hours", true),
                new Perm(Role.Admin, "scan_behalf_face", true),
                new Perm(Role.Admin, "scan_behalf_qr", true),
                new Perm(Role.Admin, "edit_leave_approvals", true),
                new Perm(Role.Admin, "delete_leave_approvals", true),

                // HR permissions
                new Perm(Role.HR, "departments", true),
                new Perm(Role.HR, "positions", true),
                new Perm(Role.HR, "employees", true),
                new Perm(Role.HR, "attendance", true),
                new Perm(Role.HR, "add_attendance", true),
                new Perm(Role.HR, "edit_attendance", true),
                new Perm(Role.HR, "delete_attendance", true),
                new Perm(Role.HR, "leaves", true),
                new Perm(Role.HR, "overtime", true),
                new Perm(Role.HR, "reports", true),
                new Perm(Role.HR, "facescan", true),
                new Perm(Role.HR, "qrscan", true),
                new Perm(Role.HR, "kiosk_settings", false),
                new Perm(Role.HR, "leave_types", true),
                new Perm(Role.HR, "leave_allowances", true),
                new Perm(Role.HR, "leave_approvals", true),
                new Perm(Role.HR, "permissions", false),
                new Perm(Role.HR, "work_hours", true),
                new Perm(Role.HR, "scan_behalf_face", true),
                new Perm(Role.HR, "scan_behalf_qr", true),
                new Perm(Role.HR, "edit_leave_approvals", true),
                new Perm(Role.HR, "delete_leave_approvals", true),

                // Manager permissions
                new Perm(Role.Manager, "departments", false),
                new Perm(Role.Manager, "positions", false),
                new Perm(Role.Manager, "employees", true),
                new Perm(Role.Manager, "attendance", true),
                new Perm(Role.Manager, "add_attendance", false),
                new Perm(Role.Manager, "edit_attendance", false),
                new Perm(Role.Manager, "delete_attendance", false),
                new Perm(Role.Manager, "leaves", true),
                new Perm(Role.Manager, "overtime", true),
                new Perm(Role.Manager, "reports", true),
                new Perm(Role.Manager, "facescan", true),
                new Perm(Role.Manager, "qrscan", true),
                new Perm(Role.Manager, "kiosk_settings", false),
                new Perm(Role.Manager, "leave_types", false),
                new Perm(Role.Manager, "leave_allowances", false),
                new Perm(Role.Manager, "leave_approvals", false),
                new Perm(Role.Manager, "permissions", false),
                new Perm(Role.Manager, "work_hours", false),
                new Perm(Role.Manager, "scan_behalf_face", false),
                new Perm(Role.Manager, "scan_behalf_qr", false),
                new Perm(Role.Manager, "edit_leave_approvals", false),
                new Perm(Role.Manager, "delete_leave_approvals", false),

                // Employee permissions
                new Perm(Role.Employee, "departments", false),
                new Perm(Role.Employee, "positions", false),
                new Perm(Role.Employee, "employees", false),
                new Perm(Role.Employee, "attendance", true),
                new Perm(Role.Employee, "add_attendance", false),
                new Perm(Role.Employee, "edit_attendance", false),
                new Perm(Role.Employee, "delete_attendance", false),
                new Perm(Role.Employee, "leaves", true),
                new Perm(Role.Employee, "overtime", true),
                new Perm(Role.Employee, "reports", false),
                new Perm(Role.Employee, "facescan", false),
                new Perm(Role.Employee, "qrscan", false),
                new Perm(Role.Employee, "kiosk_settings", false),
                new Perm(Role.Employee, "leave_types", false),
                new Perm(Role.Employee, "leave_allowances", false),
                new Perm(Role.Employee, "leave_approvals", false),
                new Perm(Role.Employee, "permissions", false),
                new Perm(Role.Employee, "work_hours", false),
                new Perm(Role.Employee, "scan_behalf_face", false),
                new Perm(Role.Employee, "scan_behalf_qr", false),
                new Perm(Role.Employee, "edit_leave_approvals", false),
                new Perm(Role.Employee, "delete_leave_approvals", false)
        );

        for (Perm p : defaultPermissions) {
            Optional<RolePermission> existing = rolePermissionRepository.findByRoleAndResource(p.role(), p.resource());
            if (existing.isEmpty()) {
                rolePermissionRepository.save(RolePermission.builder()
                        .role(p.role())
                        .resource(p.resource())
                        .canAccess(p.canAccess())
                        .build());
            }
        }
    }

    private void initializeKioskSettings() {
        if (kioskSettingRepository.count() == 0) {
            kioskSettingRepository.save(KioskSetting.builder()
                    .name("Phnom Penh HQ")
                    .latitude(11.5564)
                    .longitude(104.9282)
                    .radius(100.0)
                    .build());

            kioskSettingRepository.save(KioskSetting.builder()
                    .name("Siem Reap Branch")
                    .latitude(13.3671)
                    .longitude(103.8448)
                    .radius(150.0)
                    .build());
        }
    }

    private void initializeLeaveTypes() {
        if (leaveTypeRepository.count() == 0) {
            leaveTypeRepository.save(LeaveType.builder()
                    .code("AL")
                    .nameEn("Annual Leave")
                    .nameKh("ច្បាប់សម្រាកប្រចាំឆ្នាំ")
                    .maxDays(18.0)
                    .description("Standard paid annual leave allowance")
                    .build());

            leaveTypeRepository.save(LeaveType.builder()
                    .code("SL")
                    .nameEn("Sick Leave")
                    .nameKh("ច្បាប់ឈឺ")
                    .maxDays(12.0)
                    .description("Paid leave for medical or health issues")
                    .build());

            leaveTypeRepository.save(LeaveType.builder()
                    .code("PL")
                    .nameEn("Personal Leave")
                    .nameKh("ច្បាប់ផ្ទាល់ខ្លួន")
                    .maxDays(7.0)
                    .description("Leave for private/personal business")
                    .build());
        }
    }

    private void initializeWorkHours() {
        if (companyWorkHourRepository.count() == 0) {
            companyWorkHourRepository.save(CompanyWorkHour.builder()
                    .shift1Start("08:00")
                    .shift1End("12:00")
                    .shift2Start("13:00")
                    .shift2End("17:00")
                    .build());
        }
    }

    private void initializeDemoData() {
        if (employeeRepository.count() == 0) {
            Department deptIT = departmentRepository.save(Department.builder()
                    .nameEn("Information Technology")
                    .nameKh("បច្ចេកវិទ្យាព័ត៌មាន")
                    .description("Handles software development, infrastructure, and IT support")
                    .build());

            Department deptHR = departmentRepository.save(Department.builder()
                    .nameEn("Human Resources")
                    .nameKh("ធនធានមនុស្ស")
                    .description("Manages recruitment, staff relations, payroll, and benefits")
                    .build());

            Position posDev = positionRepository.save(Position.builder()
                    .titleEn("Software Developer")
                    .titleKh("អ្នកអភិវឌ្ឍន៍កម្មវិធី")
                    .departmentId(deptIT.getId())
                    .build());

            Position posITManager = positionRepository.save(Position.builder()
                    .titleEn("IT Manager")
                    .titleKh("ប្រធានផ្នែកបច្ចេកវិទ្យាព័ត៌មាន")
                    .departmentId(deptIT.getId())
                    .build());

            Position posHRSpecialist = positionRepository.save(Position.builder()
                    .titleEn("HR Specialist")
                    .titleKh("អ្នកឯកទេសធនធានមនុស្ស")
                    .departmentId(deptHR.getId())
                    .build());

            Position posHRManager = positionRepository.save(Position.builder()
                    .titleEn("HR Manager")
                    .titleKh("ប្រធានគ្រប់គ្រងធនធានមនុស្ស")
                    .departmentId(deptHR.getId())
                    .build());

            // 1. Admin
            employeeRepository.save(Employee.builder()
                    .staffId("EMP-001")
                    .nameEn("Sok Mean")
                    .nameKh("សុខ មាន")
                    .gender("Male")
                    .positionId(posITManager.getId())
                    .departmentId(deptIT.getId())
                    .branch("Phnom Penh HQ")
                    .joinDate(LocalDate.of(2024, 1, 15))
                    .status(Status.Active)
                    .shift1Start("08:00")
                    .shift1End("12:00")
                    .shift2Start("13:00")
                    .shift2End("17:00")
                    .email("admin@attendance.com")
                    .password(passwordEncoder.encode("admin123"))
                    .role(Role.Admin)
                    .build());

            // Also keep admin@hrchomnan.com as alias admin if someone uses it
            employeeRepository.save(Employee.builder()
                    .staffId("EMP-000")
                    .nameEn("System Administrator")
                    .nameKh("អ្នកគ្រប់គ្រងប្រព័ន្ធ")
                    .gender("Male")
                    .positionId(posITManager.getId())
                    .departmentId(deptIT.getId())
                    .branch("Phnom Penh HQ")
                    .joinDate(LocalDate.of(2024, 1, 1))
                    .status(Status.Active)
                    .shift1Start("08:00")
                    .shift1End("12:00")
                    .shift2Start("13:00")
                    .shift2End("17:00")
                    .email("admin@hrchomnan.com")
                    .password(passwordEncoder.encode("admin123"))
                    .role(Role.Admin)
                    .build());

            // 2. HR
            employeeRepository.save(Employee.builder()
                    .staffId("EMP-002")
                    .nameEn("Keo Sophea")
                    .nameKh("កែវ សុភា")
                    .gender("Female")
                    .positionId(posHRManager.getId())
                    .departmentId(deptHR.getId())
                    .branch("Phnom Penh HQ")
                    .joinDate(LocalDate.of(2024, 3, 10))
                    .status(Status.Active)
                    .shift1Start("08:00")
                    .shift1End("12:00")
                    .shift2Start("13:00")
                    .shift2End("17:00")
                    .email("hr@attendance.com")
                    .password(passwordEncoder.encode("hr123"))
                    .role(Role.HR)
                    .build());

            // 3. Manager
            employeeRepository.save(Employee.builder()
                    .staffId("EMP-003")
                    .nameEn("Chan Dara")
                    .nameKh("ចាន់ ដារ៉ា")
                    .gender("Male")
                    .positionId(posITManager.getId())
                    .departmentId(deptIT.getId())
                    .branch("Phnom Penh HQ")
                    .joinDate(LocalDate.of(2023, 11, 1))
                    .status(Status.Active)
                    .shift1Start("08:00")
                    .shift1End("12:00")
                    .shift2Start("13:00")
                    .shift2End("17:00")
                    .email("manager@attendance.com")
                    .password(passwordEncoder.encode("manager123"))
                    .role(Role.Manager)
                    .build());

            // 4. Employee Dev 1
            employeeRepository.save(Employee.builder()
                    .staffId("EMP-004")
                    .nameEn("Nguon Rath")
                    .nameKh("ងួន រ័ត្ន")
                    .gender("Male")
                    .positionId(posDev.getId())
                    .departmentId(deptIT.getId())
                    .branch("Phnom Penh HQ")
                    .joinDate(LocalDate.of(2025, 2, 20))
                    .status(Status.Active)
                    .shift1Start("08:00")
                    .shift1End("12:00")
                    .shift2Start("13:00")
                    .shift2End("17:00")
                    .email("rath@attendance.com")
                    .password(passwordEncoder.encode("emp123"))
                    .role(Role.Employee)
                    .build());

            // 5. Employee Dev 2
            employeeRepository.save(Employee.builder()
                    .staffId("EMP-005")
                    .nameEn("Phan Sreypov")
                    .nameKh("ផាន់ ស្រីពៅ")
                    .gender("Female")
                    .positionId(posDev.getId())
                    .departmentId(deptIT.getId())
                    .branch("Siem Reap Branch")
                    .joinDate(LocalDate.of(2025, 5, 1))
                    .status(Status.Active)
                    .shift1Start("08:30")
                    .shift1End("12:30")
                    .shift2Start("13:30")
                    .shift2End("17:30")
                    .email("sreypov@attendance.com")
                    .password(passwordEncoder.encode("emp123"))
                    .role(Role.Employee)
                    .build());
        }
    }
}
