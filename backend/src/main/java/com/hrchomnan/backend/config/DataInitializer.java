package com.hrchomnan.backend.config;

import com.hrchomnan.backend.enums.Role;
import com.hrchomnan.backend.enums.Status;
import com.hrchomnan.backend.model.*;
import com.hrchomnan.backend.repository.*;
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
    private final org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    @Override
    public void run(String... args) {
        log.info("Starting DataInitializer...");
        try {
            jdbcTemplate.execute("ALTER TABLE employee_face_data ALTER COLUMN photo_url TYPE TEXT");
            jdbcTemplate.execute("ALTER TABLE employee_face_data ALTER COLUMN face_descriptor TYPE TEXT");
            jdbcTemplate.execute("ALTER TABLE employees ALTER COLUMN photo_url TYPE TEXT");
            log.info("Successfully ensured TEXT columns for employee_face_data and employees.");
        } catch (Exception e) {
            log.warn("Note on table schema migration: {}", e.getMessage());
        }

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
                // Admin permissions
                new Perm(Role.Admin, "departments", true),
                new Perm(Role.Admin, "positions", true),
                new Perm(Role.Admin, "employees", true),
                new Perm(Role.Admin, "add_employee", true),
                new Perm(Role.Admin, "edit_employee", true),
                new Perm(Role.Admin, "delete_employee", true),
                new Perm(Role.Admin, "attendance", true),
                new Perm(Role.Admin, "attendance_early_in", true),
                new Perm(Role.Admin, "attendance_late", true),
                new Perm(Role.Admin, "attendance_early_out", true),
                new Perm(Role.Admin, "add_attendance", true),
                new Perm(Role.Admin, "edit_attendance", true),
                new Perm(Role.Admin, "delete_attendance", true),
                new Perm(Role.Admin, "leaves", true),
                new Perm(Role.Admin, "approve_leaves", true),
                new Perm(Role.Admin, "overtime", true),
                new Perm(Role.Admin, "approve_overtime", true),
                new Perm(Role.Admin, "delete_overtime", true),
                new Perm(Role.Admin, "reports", true),
                new Perm(Role.Admin, "facescan", true),
                new Perm(Role.Admin, "qrscan", true),
                new Perm(Role.Admin, "kiosk_settings", true),
                new Perm(Role.Admin, "leave_types", true),
                new Perm(Role.Admin, "leave_allowances", true),
                new Perm(Role.Admin, "leave_approvals", true),
                new Perm(Role.Admin, "edit_leave_approvals", true),
                new Perm(Role.Admin, "delete_leave_approvals", true),
                new Perm(Role.Admin, "work_hours", true),
                new Perm(Role.Admin, "telegram_settings", true),
                new Perm(Role.Admin, "scan_behalf_face", true),
                new Perm(Role.Admin, "scan_behalf_qr", true),
                new Perm(Role.Admin, "permissions", true),

                // HR permissions
                new Perm(Role.HR, "departments", true),
                new Perm(Role.HR, "positions", true),
                new Perm(Role.HR, "employees", true),
                new Perm(Role.HR, "add_employee", true),
                new Perm(Role.HR, "edit_employee", true),
                new Perm(Role.HR, "delete_employee", true),
                new Perm(Role.HR, "attendance", true),
                new Perm(Role.HR, "attendance_early_in", true),
                new Perm(Role.HR, "attendance_late", true),
                new Perm(Role.HR, "attendance_early_out", true),
                new Perm(Role.HR, "add_attendance", true),
                new Perm(Role.HR, "edit_attendance", true),
                new Perm(Role.HR, "delete_attendance", true),
                new Perm(Role.HR, "leaves", true),
                new Perm(Role.HR, "approve_leaves", true),
                new Perm(Role.HR, "overtime", true),
                new Perm(Role.HR, "approve_overtime", true),
                new Perm(Role.HR, "delete_overtime", true),
                new Perm(Role.HR, "reports", true),
                new Perm(Role.HR, "facescan", true),
                new Perm(Role.HR, "qrscan", true),
                new Perm(Role.HR, "kiosk_settings", false),
                new Perm(Role.HR, "leave_types", true),
                new Perm(Role.HR, "leave_allowances", true),
                new Perm(Role.HR, "leave_approvals", true),
                new Perm(Role.HR, "edit_leave_approvals", true),
                new Perm(Role.HR, "delete_leave_approvals", true),
                new Perm(Role.HR, "work_hours", true),
                new Perm(Role.HR, "telegram_settings", true),
                new Perm(Role.HR, "scan_behalf_face", true),
                new Perm(Role.HR, "scan_behalf_qr", true),
                new Perm(Role.HR, "permissions", false),

                // Manager permissions
                new Perm(Role.Manager, "departments", false),
                new Perm(Role.Manager, "positions", false),
                new Perm(Role.Manager, "employees", true),
                new Perm(Role.Manager, "add_employee", false),
                new Perm(Role.Manager, "edit_employee", false),
                new Perm(Role.Manager, "delete_employee", false),
                new Perm(Role.Manager, "attendance", true),
                new Perm(Role.Manager, "attendance_early_in", true),
                new Perm(Role.Manager, "attendance_late", true),
                new Perm(Role.Manager, "attendance_early_out", true),
                new Perm(Role.Manager, "add_attendance", false),
                new Perm(Role.Manager, "edit_attendance", false),
                new Perm(Role.Manager, "delete_attendance", false),
                new Perm(Role.Manager, "leaves", true),
                new Perm(Role.Manager, "approve_leaves", true),
                new Perm(Role.Manager, "overtime", true),
                new Perm(Role.Manager, "approve_overtime", true),
                new Perm(Role.Manager, "delete_overtime", false),
                new Perm(Role.Manager, "reports", true),
                new Perm(Role.Manager, "facescan", true),
                new Perm(Role.Manager, "qrscan", true),
                new Perm(Role.Manager, "kiosk_settings", false),
                new Perm(Role.Manager, "leave_types", false),
                new Perm(Role.Manager, "leave_allowances", false),
                new Perm(Role.Manager, "leave_approvals", false),
                new Perm(Role.Manager, "edit_leave_approvals", false),
                new Perm(Role.Manager, "delete_leave_approvals", false),
                new Perm(Role.Manager, "work_hours", false),
                new Perm(Role.Manager, "telegram_settings", false),
                new Perm(Role.Manager, "scan_behalf_face", false),
                new Perm(Role.Manager, "scan_behalf_qr", false),
                new Perm(Role.Manager, "permissions", false),

                // Employee permissions
                new Perm(Role.Employee, "departments", false),
                new Perm(Role.Employee, "positions", false),
                new Perm(Role.Employee, "employees", false),
                new Perm(Role.Employee, "add_employee", false),
                new Perm(Role.Employee, "edit_employee", false),
                new Perm(Role.Employee, "delete_employee", false),
                new Perm(Role.Employee, "attendance", true),
                new Perm(Role.Employee, "attendance_early_in", false),
                new Perm(Role.Employee, "attendance_late", false),
                new Perm(Role.Employee, "attendance_early_out", false),
                new Perm(Role.Employee, "add_attendance", false),
                new Perm(Role.Employee, "edit_attendance", false),
                new Perm(Role.Employee, "delete_attendance", false),
                new Perm(Role.Employee, "leaves", true),
                new Perm(Role.Employee, "approve_leaves", false),
                new Perm(Role.Employee, "overtime", true),
                new Perm(Role.Employee, "approve_overtime", false),
                new Perm(Role.Employee, "delete_overtime", false),
                new Perm(Role.Employee, "reports", false),
                new Perm(Role.Employee, "facescan", false),
                new Perm(Role.Employee, "qrscan", false),
                new Perm(Role.Employee, "kiosk_settings", false),
                new Perm(Role.Employee, "leave_types", false),
                new Perm(Role.Employee, "leave_allowances", false),
                new Perm(Role.Employee, "leave_approvals", false),
                new Perm(Role.Employee, "edit_leave_approvals", false),
                new Perm(Role.Employee, "delete_leave_approvals", false),
                new Perm(Role.Employee, "work_hours", false),
                new Perm(Role.Employee, "telegram_settings", false),
                new Perm(Role.Employee, "scan_behalf_face", false),
                new Perm(Role.Employee, "scan_behalf_qr", false),
                new Perm(Role.Employee, "permissions", false)
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
        Department deptIT = departmentRepository.findAll().stream()
                .filter(d -> "Information Technology".equalsIgnoreCase(d.getNameEn()))
                .findFirst()
                .orElseGet(() -> departmentRepository.save(Department.builder()
                        .nameEn("Information Technology")
                        .nameKh("បច្ចេកវិទ្យាព័ត៌មាន")
                        .description("Handles software development, infrastructure, and IT support")
                        .build()));

        Department deptHR = departmentRepository.findAll().stream()
                .filter(d -> "Human Resources".equalsIgnoreCase(d.getNameEn()))
                .findFirst()
                .orElseGet(() -> departmentRepository.save(Department.builder()
                        .nameEn("Human Resources")
                        .nameKh("ធនធានមនុស្ស")
                        .description("Manages recruitment, staff relations, payroll, and benefits")
                        .build()));

        Department deptFinance = departmentRepository.findAll().stream()
                .filter(d -> "Finance & Accounting".equalsIgnoreCase(d.getNameEn()) || "Finance".equalsIgnoreCase(d.getNameEn()))
                .findFirst()
                .orElseGet(() -> departmentRepository.save(Department.builder()
                        .nameEn("Finance & Accounting")
                        .nameKh("ហិរញ្ញវត្ថុ និងគណនេយ្យ")
                        .description("Financial management, bookkeeping, and payroll accounting")
                        .build()));

        Department deptMarketing = departmentRepository.findAll().stream()
                .filter(d -> "Marketing & Operations".equalsIgnoreCase(d.getNameEn()) || "Marketing".equalsIgnoreCase(d.getNameEn()))
                .findFirst()
                .orElseGet(() -> departmentRepository.save(Department.builder()
                        .nameEn("Marketing & Operations")
                        .nameKh("ទីផ្សារ និងប្រតិបត្តិការ")
                        .description("Brand marketing, digital campaigns, and daily business operations")
                        .build()));

        Position posITManager = getOrCreatePosition("IT Manager", "ប្រធានផ្នែកបច្ចេកវិទ្យាព័ត៌មាន", deptIT.getId());
        Position posSrDev = getOrCreatePosition("Senior Software Engineer", "វិស្វករកម្មវិធីជាន់ខ្ពស់", deptIT.getId());
        Position posDev = getOrCreatePosition("Software Developer", "អ្នកអភិវឌ្ឍន៍កម្មវិធី", deptIT.getId());
        Position posUIDesigner = getOrCreatePosition("UI/UX Designer", "អ្នករចនា UI/UX", deptIT.getId());
        Position posNetwork = getOrCreatePosition("Network Specialist", "អ្នកឯកទេសប្រព័ន្ធបណ្ដាញ", deptIT.getId());

        Position posHRManager = getOrCreatePosition("HR Manager", "ប្រធានគ្រប់គ្រងធនធានមនុស្ស", deptIT.getId() != null ? deptHR.getId() : null);
        Position posHRSpecialist = getOrCreatePosition("HR Specialist", "អ្នកឯកទេសធនធានមនុស្ស", deptHR.getId());

        Position posFinanceMgr = getOrCreatePosition("Finance Manager", "ប្រធានផ្នែកហិរញ្ញវត្ថុ", deptFinance.getId());
        Position posAccountant = getOrCreatePosition("Senior Accountant", "គណនេយ្យករជាន់ខ្ពស់", deptFinance.getId());

        Position posMktLead = getOrCreatePosition("Marketing Lead", "ប្រធានផ្នែកទីផ្សារ", deptMarketing.getId());
        Position posOpsOfficer = getOrCreatePosition("Operations Officer", "មន្ត្រីប្រតិបត្តិការ", deptMarketing.getId());

        List<Employee> employeeSeedList = List.of(
                // 1. Admin
                Employee.builder()
                        .staffId("EMP-001")
                        .nameEn("Khoem Piseth")
                        .nameKh("ខឹម ពិសិដ្ឋ")
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
                        .build(),

                // 2. HR Manager
                Employee.builder()
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
                        .build(),

                // 3. Manager
                Employee.builder()
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
                        .build(),

                // 4. Employee Dev 1
                Employee.builder()
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
                        .build(),

                // 5. Employee Dev 2
                Employee.builder()
                        .staffId("EMP-005")
                        .nameEn("Phan Sreypov")
                        .nameKh("ផាន់ ស្រីពៅ")
                        .gender("Female")
                        .positionId(posUIDesigner.getId())
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
                        .build(),

                // 6. Senior Dev
                Employee.builder()
                        .staffId("EMP-006")
                        .nameEn("Heng Mengly")
                        .nameKh("ហេង ម៉េងលី")
                        .gender("Male")
                        .positionId(posSrDev.getId())
                        .departmentId(deptIT.getId())
                        .branch("Phnom Penh HQ")
                        .joinDate(LocalDate.of(2024, 6, 15))
                        .status(Status.Active)
                        .shift1Start("08:00")
                        .shift1End("12:00")
                        .shift2Start("13:00")
                        .shift2End("17:00")
                        .email("mengly@attendance.com")
                        .password(passwordEncoder.encode("emp123"))
                        .role(Role.Employee)
                        .build(),

                // 7. Network Specialist
                Employee.builder()
                        .staffId("EMP-007")
                        .nameEn("Youn Vichea")
                        .nameKh("យុន វិជ្ជា")
                        .gender("Male")
                        .positionId(posNetwork.getId())
                        .departmentId(deptIT.getId())
                        .branch("Phnom Penh HQ")
                        .joinDate(LocalDate.of(2024, 8, 1))
                        .status(Status.Active)
                        .shift1Start("08:00")
                        .shift1End("12:00")
                        .shift2Start("13:00")
                        .shift2End("17:00")
                        .email("vichea@attendance.com")
                        .password(passwordEncoder.encode("emp123"))
                        .role(Role.Employee)
                        .build(),

                // 8. Finance Manager
                Employee.builder()
                        .staffId("EMP-008")
                        .nameEn("Chhim Sokha")
                        .nameKh("ឈឹម សុខា")
                        .gender("Female")
                        .positionId(posFinanceMgr.getId())
                        .departmentId(deptFinance.getId())
                        .branch("Phnom Penh HQ")
                        .joinDate(LocalDate.of(2023, 9, 10))
                        .status(Status.Active)
                        .shift1Start("08:00")
                        .shift1End("12:00")
                        .shift2Start("13:00")
                        .shift2End("17:00")
                        .email("sokha@attendance.com")
                        .password(passwordEncoder.encode("manager123"))
                        .role(Role.Manager)
                        .build(),

                // 9. Senior Accountant
                Employee.builder()
                        .staffId("EMP-009")
                        .nameEn("Long Bopha")
                        .nameKh("ឡុង បុប្ផា")
                        .gender("Female")
                        .positionId(posAccountant.getId())
                        .departmentId(deptFinance.getId())
                        .branch("Battambang Branch")
                        .joinDate(LocalDate.of(2024, 11, 20))
                        .status(Status.Active)
                        .shift1Start("08:00")
                        .shift1End("12:00")
                        .shift2Start("13:00")
                        .shift2End("17:00")
                        .email("bopha@attendance.com")
                        .password(passwordEncoder.encode("emp123"))
                        .role(Role.Employee)
                        .build(),

                // 10. Marketing Lead
                Employee.builder()
                        .staffId("EMP-010")
                        .nameEn("Chea Sovann")
                        .nameKh("ជា សុវណ្ណ")
                        .gender("Male")
                        .positionId(posMktLead.getId())
                        .departmentId(deptMarketing.getId())
                        .branch("Phnom Penh HQ")
                        .joinDate(LocalDate.of(2023, 12, 5))
                        .status(Status.Active)
                        .shift1Start("08:00")
                        .shift1End("12:00")
                        .shift2Start("13:00")
                        .shift2End("17:00")
                        .email("sovann@attendance.com")
                        .password(passwordEncoder.encode("manager123"))
                        .role(Role.Manager)
                        .build(),

                // 11. HR Specialist
                Employee.builder()
                        .staffId("EMP-011")
                        .nameEn("Tep Kanha")
                        .nameKh("ទេព កញ្ញា")
                        .gender("Female")
                        .positionId(posHRSpecialist.getId())
                        .departmentId(deptHR.getId())
                        .branch("Siem Reap Branch")
                        .joinDate(LocalDate.of(2025, 1, 10))
                        .status(Status.Active)
                        .shift1Start("08:00")
                        .shift1End("12:00")
                        .shift2Start("13:00")
                        .shift2End("17:00")
                        .email("kanha@attendance.com")
                        .password(passwordEncoder.encode("emp123"))
                        .role(Role.Employee)
                        .build(),

                // 12. Operations Officer
                Employee.builder()
                        .staffId("EMP-012")
                        .nameEn("Vannak Rithy")
                        .nameKh("វណ្ណៈ រិទ្ធី")
                        .gender("Male")
                        .positionId(posOpsOfficer.getId())
                        .departmentId(deptMarketing.getId())
                        .branch("Sihanoukville Branch")
                        .joinDate(LocalDate.of(2025, 3, 1))
                        .status(Status.Active)
                        .shift1Start("08:00")
                        .shift1End("12:00")
                        .shift2Start("13:00")
                        .shift2End("17:00")
                        .email("rithy@attendance.com")
                        .password(passwordEncoder.encode("emp123"))
                        .role(Role.Employee)
                        .build()
        );

        for (Employee emp : employeeSeedList) {
            if (!employeeRepository.existsByStaffId(emp.getStaffId()) && !employeeRepository.existsByEmail(emp.getEmail())) {
                employeeRepository.save(emp);
                log.info("Seeded employee: {} ({})", emp.getNameEn(), emp.getStaffId());
            }
        }
    }

    private Position getOrCreatePosition(String titleEn, String titleKh, java.util.UUID deptId) {
        return positionRepository.findAll().stream()
                .filter(p -> titleEn.equalsIgnoreCase(p.getTitleEn()))
                .findFirst()
                .orElseGet(() -> positionRepository.save(Position.builder()
                        .titleEn(titleEn)
                        .titleKh(titleKh)
                        .departmentId(deptId)
                        .build()));
    }
}
