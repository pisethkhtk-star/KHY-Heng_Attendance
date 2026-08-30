package com.hrchomnan.backend.config;

import com.hrchomnan.backend.enums.LeaveStatus;
import com.hrchomnan.backend.enums.Role;
import com.hrchomnan.backend.enums.Status;
import com.hrchomnan.backend.model.*;
import com.hrchomnan.backend.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Random;

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
    private final AttendanceRepository attendanceRepository;
    private final LeaveRepository leaveRepository;
    private final OvertimeRepository overtimeRepository;
    private final PasswordEncoder passwordEncoder;
    private final org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    @Override
    public void run(String... args) {
        log.info("Starting DataInitializer...");
        try {
            jdbcTemplate.execute("ALTER TABLE employee_face_data ALTER COLUMN photo_url TYPE TEXT");
            jdbcTemplate.execute("ALTER TABLE employee_face_data ALTER COLUMN face_descriptor TYPE TEXT");
            jdbcTemplate.execute("ALTER TABLE employees ALTER COLUMN photo_url TYPE TEXT");
            jdbcTemplate.execute("UPDATE employees e SET photo_url = f.photo_url FROM employee_face_data f WHERE e.staff_id = f.staff_id AND (e.photo_url IS NULL OR e.photo_url = '') AND f.photo_url IS NOT NULL");
            log.info("Successfully ensured TEXT columns and synced photos from employee_face_data.");
        } catch (Exception e) {
            log.warn("Note on table schema migration or photo sync: {}", e.getMessage());
        }

        initializePermissions();
        initializeKioskSettings();
        initializeLeaveTypes();
        initializeWorkHours();
        initializeDemoData();
        initializeTwoMonthsAttendanceAndLeaves();
        log.info("DataInitializer completed successfully.");
    }

    private void initializePermissions() {
        record Perm(Role role, String resource, boolean canAccess) {}

        List<Perm> defaultPermissions = List.of(
                // Admin permissions (full access)
                new Perm(Role.Admin, "departments", true),
                new Perm(Role.Admin, "add_department", true),
                new Perm(Role.Admin, "edit_department", true),
                new Perm(Role.Admin, "delete_department", true),
                new Perm(Role.Admin, "positions", true),
                new Perm(Role.Admin, "add_position", true),
                new Perm(Role.Admin, "edit_position", true),
                new Perm(Role.Admin, "delete_position", true),
                new Perm(Role.Admin, "employees", true),
                new Perm(Role.Admin, "add_employee", true),
                new Perm(Role.Admin, "edit_employee", true),
                new Perm(Role.Admin, "delete_employee", true),
                new Perm(Role.Admin, "work_hours", true),
                new Perm(Role.Admin, "attendance", true),
                new Perm(Role.Admin, "attendance_early_in", true),
                new Perm(Role.Admin, "attendance_late", true),
                new Perm(Role.Admin, "attendance_early_out", true),
                new Perm(Role.Admin, "attendance_incomplete", true),
                new Perm(Role.Admin, "add_attendance", true),
                new Perm(Role.Admin, "edit_attendance", true),
                new Perm(Role.Admin, "delete_attendance", true),
                new Perm(Role.Admin, "overtime", true),
                new Perm(Role.Admin, "approve_overtime", true),
                new Perm(Role.Admin, "edit_overtime", true),
                new Perm(Role.Admin, "delete_overtime", true),
                new Perm(Role.Admin, "leaves", true),
                new Perm(Role.Admin, "approve_leaves", true),
                new Perm(Role.Admin, "leave_types", true),
                new Perm(Role.Admin, "leave_allowances", true),
                new Perm(Role.Admin, "leave_approvals", true),
                new Perm(Role.Admin, "edit_leave_approvals", true),
                new Perm(Role.Admin, "delete_leave_approvals", true),
                new Perm(Role.Admin, "facescan", true),
                new Perm(Role.Admin, "qrscan", true),
                new Perm(Role.Admin, "kiosk_settings", true),
                new Perm(Role.Admin, "scan_behalf_face", true),
                new Perm(Role.Admin, "scan_behalf_qr", true),
                new Perm(Role.Admin, "reports", true),
                new Perm(Role.Admin, "leave_reports", true),
                new Perm(Role.Admin, "export_reports", true),
                new Perm(Role.Admin, "telegram_settings", true),
                new Perm(Role.Admin, "permissions", true),
                new Perm(Role.Admin, "toggle_web_login", true),

                // HR permissions
                new Perm(Role.HR, "departments", true),
                new Perm(Role.HR, "add_department", true),
                new Perm(Role.HR, "edit_department", true),
                new Perm(Role.HR, "delete_department", true),
                new Perm(Role.HR, "positions", true),
                new Perm(Role.HR, "add_position", true),
                new Perm(Role.HR, "edit_position", true),
                new Perm(Role.HR, "delete_position", true),
                new Perm(Role.HR, "employees", true),
                new Perm(Role.HR, "add_employee", true),
                new Perm(Role.HR, "edit_employee", true),
                new Perm(Role.HR, "delete_employee", true),
                new Perm(Role.HR, "work_hours", true),
                new Perm(Role.HR, "attendance", true),
                new Perm(Role.HR, "attendance_early_in", true),
                new Perm(Role.HR, "attendance_late", true),
                new Perm(Role.HR, "attendance_early_out", true),
                new Perm(Role.HR, "attendance_incomplete", true),
                new Perm(Role.HR, "add_attendance", true),
                new Perm(Role.HR, "edit_attendance", true),
                new Perm(Role.HR, "delete_attendance", true),
                new Perm(Role.HR, "overtime", true),
                new Perm(Role.HR, "approve_overtime", true),
                new Perm(Role.HR, "edit_overtime", true),
                new Perm(Role.HR, "delete_overtime", true),
                new Perm(Role.HR, "leaves", true),
                new Perm(Role.HR, "approve_leaves", true),
                new Perm(Role.HR, "leave_types", true),
                new Perm(Role.HR, "leave_allowances", true),
                new Perm(Role.HR, "leave_approvals", true),
                new Perm(Role.HR, "edit_leave_approvals", true),
                new Perm(Role.HR, "delete_leave_approvals", true),
                new Perm(Role.HR, "facescan", true),
                new Perm(Role.HR, "qrscan", true),
                new Perm(Role.HR, "kiosk_settings", false),
                new Perm(Role.HR, "scan_behalf_face", true),
                new Perm(Role.HR, "scan_behalf_qr", true),
                new Perm(Role.HR, "reports", true),
                new Perm(Role.HR, "leave_reports", true),
                new Perm(Role.HR, "export_reports", true),
                new Perm(Role.HR, "telegram_settings", true),
                new Perm(Role.HR, "permissions", false),
                new Perm(Role.HR, "toggle_web_login", true),

                // Manager permissions
                new Perm(Role.Manager, "departments", false),
                new Perm(Role.Manager, "add_department", false),
                new Perm(Role.Manager, "edit_department", false),
                new Perm(Role.Manager, "delete_department", false),
                new Perm(Role.Manager, "positions", false),
                new Perm(Role.Manager, "add_position", false),
                new Perm(Role.Manager, "edit_position", false),
                new Perm(Role.Manager, "delete_position", false),
                new Perm(Role.Manager, "employees", true),
                new Perm(Role.Manager, "add_employee", false),
                new Perm(Role.Manager, "edit_employee", false),
                new Perm(Role.Manager, "delete_employee", false),
                new Perm(Role.Manager, "work_hours", false),
                new Perm(Role.Manager, "attendance", true),
                new Perm(Role.Manager, "attendance_early_in", true),
                new Perm(Role.Manager, "attendance_late", true),
                new Perm(Role.Manager, "attendance_early_out", true),
                new Perm(Role.Manager, "attendance_incomplete", true),
                new Perm(Role.Manager, "add_attendance", false),
                new Perm(Role.Manager, "edit_attendance", false),
                new Perm(Role.Manager, "delete_attendance", false),
                new Perm(Role.Manager, "overtime", true),
                new Perm(Role.Manager, "approve_overtime", true),
                new Perm(Role.Manager, "edit_overtime", false),
                new Perm(Role.Manager, "delete_overtime", false),
                new Perm(Role.Manager, "leaves", true),
                new Perm(Role.Manager, "approve_leaves", true),
                new Perm(Role.Manager, "leave_types", false),
                new Perm(Role.Manager, "leave_allowances", false),
                new Perm(Role.Manager, "leave_approvals", false),
                new Perm(Role.Manager, "edit_leave_approvals", false),
                new Perm(Role.Manager, "delete_leave_approvals", false),
                new Perm(Role.Manager, "facescan", true),
                new Perm(Role.Manager, "qrscan", true),
                new Perm(Role.Manager, "kiosk_settings", false),
                new Perm(Role.Manager, "scan_behalf_face", false),
                new Perm(Role.Manager, "scan_behalf_qr", false),
                new Perm(Role.Manager, "reports", true),
                new Perm(Role.Manager, "leave_reports", true),
                new Perm(Role.Manager, "export_reports", true),
                new Perm(Role.Manager, "telegram_settings", false),
                new Perm(Role.Manager, "permissions", false),
                new Perm(Role.Manager, "toggle_web_login", false),

                // Employee permissions
                new Perm(Role.Employee, "departments", false),
                new Perm(Role.Employee, "add_department", false),
                new Perm(Role.Employee, "edit_department", false),
                new Perm(Role.Employee, "delete_department", false),
                new Perm(Role.Employee, "positions", false),
                new Perm(Role.Employee, "add_position", false),
                new Perm(Role.Employee, "edit_position", false),
                new Perm(Role.Employee, "delete_position", false),
                new Perm(Role.Employee, "employees", false),
                new Perm(Role.Employee, "add_employee", false),
                new Perm(Role.Employee, "edit_employee", false),
                new Perm(Role.Employee, "delete_employee", false),
                new Perm(Role.Employee, "work_hours", false),
                new Perm(Role.Employee, "attendance", true),
                new Perm(Role.Employee, "attendance_early_in", false),
                new Perm(Role.Employee, "attendance_late", false),
                new Perm(Role.Employee, "attendance_early_out", false),
                new Perm(Role.Employee, "attendance_incomplete", false),
                new Perm(Role.Employee, "add_attendance", false),
                new Perm(Role.Employee, "edit_attendance", false),
                new Perm(Role.Employee, "delete_attendance", false),
                new Perm(Role.Employee, "overtime", true),
                new Perm(Role.Employee, "approve_overtime", false),
                new Perm(Role.Employee, "edit_overtime", false),
                new Perm(Role.Employee, "delete_overtime", false),
                new Perm(Role.Employee, "leaves", true),
                new Perm(Role.Employee, "approve_leaves", false),
                new Perm(Role.Employee, "leave_types", false),
                new Perm(Role.Employee, "leave_allowances", false),
                new Perm(Role.Employee, "leave_approvals", false),
                new Perm(Role.Employee, "edit_leave_approvals", false),
                new Perm(Role.Employee, "delete_leave_approvals", false),
                new Perm(Role.Employee, "facescan", false),
                new Perm(Role.Employee, "qrscan", false),
                new Perm(Role.Employee, "kiosk_settings", false),
                new Perm(Role.Employee, "scan_behalf_face", false),
                new Perm(Role.Employee, "scan_behalf_qr", false),
                new Perm(Role.Employee, "reports", false),
                new Perm(Role.Employee, "leave_reports", false),
                new Perm(Role.Employee, "export_reports", false),
                new Perm(Role.Employee, "telegram_settings", false),
                new Perm(Role.Employee, "permissions", false),
                new Perm(Role.Employee, "toggle_web_login", false)
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

    private void initializeTwoMonthsAttendanceAndLeaves() {
        log.info("Checking and seeding 2 months of attendance, leaves, and overtime data...");
        List<Employee> allEmployees = employeeRepository.findAll();
        if (allEmployees.isEmpty()) return;

        // 1. Seed Leaves for July & August 2026
        record LeaveSeed(String staffId, LocalDate date, String type, double days, String reason, String duration) {}
        List<LeaveSeed> leaveSeeds = List.of(
                new LeaveSeed("EMP-001", LocalDate.of(2026, 7, 10), "AL", 1.0, "Family vacation trip", "Full Day"),
                new LeaveSeed("EMP-002", LocalDate.of(2026, 7, 15), "AL", 1.0, "Personal annual leave", "Full Day"),
                new LeaveSeed("EMP-002", LocalDate.of(2026, 8, 3), "SL", 1.0, "Fever & doctor consultation", "Full Day"),
                new LeaveSeed("EMP-003", LocalDate.of(2026, 7, 24), "PL", 1.0, "Attending wedding ceremony", "Full Day"),
                new LeaveSeed("EMP-004", LocalDate.of(2026, 7, 22), "SL", 1.0, "Sick leave with medical certificate", "Full Day"),
                new LeaveSeed("EMP-004", LocalDate.of(2026, 8, 14), "AL", 0.5, "Morning doctor appointment", "Morning"),
                new LeaveSeed("EMP-005", LocalDate.of(2026, 8, 5), "PL", 0.5, "Morning administrative banking", "Morning"),
                new LeaveSeed("EMP-006", LocalDate.of(2026, 8, 18), "AL", 1.0, "Annual vacation", "Full Day"),
                new LeaveSeed("EMP-007", LocalDate.of(2026, 7, 31), "PL", 0.5, "Afternoon family business", "Afternoon"),
                new LeaveSeed("EMP-008", LocalDate.of(2026, 8, 11), "AL", 1.0, "Annual leave trip", "Full Day"),
                new LeaveSeed("EMP-008", LocalDate.of(2026, 8, 12), "AL", 1.0, "Annual leave trip", "Full Day"),
                new LeaveSeed("EMP-009", LocalDate.of(2026, 8, 19), "SL", 0.5, "Afternoon medical checkup", "Afternoon"),
                new LeaveSeed("EMP-010", LocalDate.of(2026, 7, 17), "PL", 1.0, "Private family event", "Full Day"),
                new LeaveSeed("EMP-011", LocalDate.of(2026, 7, 28), "AL", 1.0, "Annual leave", "Full Day"),
                new LeaveSeed("EMP-012", LocalDate.of(2026, 8, 21), "SL", 1.0, "Flu recovery", "Full Day")
        );

        for (LeaveSeed ls : leaveSeeds) {
            boolean exists = leaveRepository.findByStaffId(ls.staffId()).stream()
                    .anyMatch(l -> ls.date().equals(l.getLeaveDate()));
            if (!exists) {
                leaveRepository.save(Leave.builder()
                        .staffId(ls.staffId())
                        .leaveDate(ls.date())
                        .leaveType(ls.type())
                        .amountDays(BigDecimal.valueOf(ls.days()))
                        .reason(ls.reason() + " (" + ls.duration() + ")")
                        .status(LeaveStatus.Approved)
                        .managerName("Admin")
                        .requestedAt(ls.date().atTime(9, 0))
                        .approvedAt(ls.date().atTime(10, 0))
                        .createdBy("Admin")
                        .build());
            }
        }

        // 2. Seed Attendances from July 1, 2026 to August 28, 2026
        LocalDate start = LocalDate.of(2026, 7, 1);
        LocalDate end = LocalDate.of(2026, 8, 28);

        LocalDate cur = start;
        while (!cur.isAfter(end)) {
            DayOfWeek dow = cur.getDayOfWeek();
            // Skip weekends
            if (dow != DayOfWeek.SATURDAY && dow != DayOfWeek.SUNDAY) {
                final LocalDate curDate = cur;

                for (Employee emp : allEmployees) {
                    // Skip if date is before employee join date
                    if (emp.getJoinDate() != null && curDate.isBefore(emp.getJoinDate())) {
                        continue;
                    }

                    // Check if attendance already exists
                    Optional<Attendance> existingAtt = attendanceRepository.findByStaffIdAndAttendanceDate(emp.getStaffId(), curDate);
                    if (existingAtt.isPresent()) {
                        continue;
                    }

                    // Check if employee has leave on this date
                    Optional<Leave> leaveOpt = leaveRepository.findByStaffId(emp.getStaffId()).stream()
                            .filter(l -> curDate.equals(l.getLeaveDate()) && l.getStatus() == LeaveStatus.Approved)
                            .findFirst();

                    boolean hasFullLeave = false;
                    boolean hasMorningLeave = false;
                    boolean hasAfternoonLeave = false;

                    if (leaveOpt.isPresent()) {
                        Leave lv = leaveOpt.get();
                        double days = lv.getAmountDays() != null ? lv.getAmountDays().doubleValue() : 1.0;
                        String reason = (lv.getReason() != null ? lv.getReason().toLowerCase() : "");
                        if (days >= 1.0 || (!reason.contains("morning") && !reason.contains("afternoon") && days > 0.5)) {
                            hasFullLeave = true;
                        } else if (reason.contains("morning")) {
                            hasMorningLeave = true;
                        } else if (reason.contains("afternoon")) {
                            hasAfternoonLeave = true;
                        }
                    }

                    // If full day leave, do not insert attendance record
                    if (hasFullLeave) {
                        continue;
                    }

                    // Deterministic seed for realistic variation per employee and date
                    long seed = ((long) emp.getStaffId().hashCode() * 397) ^ (curDate.toEpochDay() * 7919);
                    Random rand = new Random(seed);
                    int r = rand.nextInt(100);

                    String c1 = null;
                    String o1 = null;
                    String c2 = null;
                    String o2 = null;
                    boolean isLate = false;
                    boolean isEarlyLeave = false;
                    String note = "";

                    if (hasMorningLeave) {
                        // Morning excused, afternoon attended
                        c2 = String.format("12:%02d:00", 50 + rand.nextInt(10));
                        o2 = String.format("17:%02d:00", rand.nextInt(15));
                        note = "Morning Leave Excused";
                    } else if (hasAfternoonLeave) {
                        // Morning attended, afternoon excused
                        c1 = String.format("07:%02d:00", 45 + rand.nextInt(14));
                        o1 = String.format("12:%02d:00", rand.nextInt(6));
                        note = "Afternoon Leave Excused";
                    } else {
                        // Normal attendance simulation
                        if (r < 75) {
                            // On-Time regular scan
                            c1 = String.format("07:%02d:00", 45 + rand.nextInt(14));
                            o1 = String.format("12:%02d:00", rand.nextInt(8));
                            c2 = String.format("12:%02d:00", 50 + rand.nextInt(10));
                            o2 = String.format("17:%02d:00", rand.nextInt(15));
                        } else if (r < 84) {
                            // Late In (Shift 1)
                            int lateMin = 10 + rand.nextInt(25);
                            c1 = String.format("08:%02d:00", lateMin);
                            o1 = String.format("12:%02d:00", rand.nextInt(6));
                            c2 = String.format("12:%02d:00", 55 + rand.nextInt(5));
                            o2 = String.format("17:%02d:00", rand.nextInt(10));
                            isLate = true;
                            note = "Checkin: Late In";
                        } else if (r < 90) {
                            // Early Leave (Shift 2)
                            c1 = String.format("07:%02d:00", 48 + rand.nextInt(10));
                            o1 = String.format("12:%02d:00", rand.nextInt(5));
                            c2 = String.format("12:%02d:00", 55 + rand.nextInt(5));
                            int earlyMin = 30 + rand.nextInt(20);
                            o2 = String.format("16:%02d:00", earlyMin);
                            isEarlyLeave = true;
                            note = "Checkout: Early Leave";
                        } else if (r < 94) {
                            // Incomplete: Missing Check-out 1
                            c1 = String.format("07:%02d:00", 48 + rand.nextInt(10));
                            o1 = null;
                            c2 = String.format("12:%02d:00", 55 + rand.nextInt(5));
                            o2 = String.format("17:%02d:00", rand.nextInt(10));
                            note = "Missing Checkout 1";
                        } else if (r < 98) {
                            // Incomplete: Missing Check-in 2
                            c1 = String.format("07:%02d:00", 48 + rand.nextInt(10));
                            o1 = String.format("12:%02d:00", rand.nextInt(5));
                            c2 = null;
                            o2 = String.format("17:%02d:00", rand.nextInt(10));
                            note = "Missing Checkin 2";
                        } else {
                            // Absent / No scan on working day
                            c1 = null;
                            o1 = null;
                            c2 = null;
                            o2 = null;
                            note = "No Scan (Absent)";
                        }
                    }

                    if (c1 != null || o1 != null || c2 != null || o2 != null) {
                        attendanceRepository.save(Attendance.builder()
                                .staffId(emp.getStaffId())
                                .attendanceDate(curDate)
                                .checkin1(c1)
                                .checkout1(o1)
                                .checkin2(c2)
                                .checkout2(o2)
                                .isLate(isLate)
                                .isEarlyLeave(isEarlyLeave)
                                .note(note)
                                .build());
                    }
                }
            }
            cur = cur.plusDays(1);
        }

        // 3. Seed Overtime for July & August
        if (overtimeRepository.count() < 5) {
            record OtSeed(String staffId, LocalDate date, String start, String end, double hrs, String reason, LeaveStatus status) {}
            List<OtSeed> otSeeds = List.of(
                    new OtSeed("EMP-001", LocalDate.of(2026, 7, 8), "17:30", "20:00", 2.5, "Deploy new release to production", LeaveStatus.Approved),
                    new OtSeed("EMP-004", LocalDate.of(2026, 7, 20), "17:30", "19:30", 2.0, "Fix urgent bug in reporting module", LeaveStatus.Approved),
                    new OtSeed("EMP-006", LocalDate.of(2026, 8, 6), "17:30", "21:00", 3.5, "Database migration & security audit backup", LeaveStatus.Approved),
                    new OtSeed("EMP-009", LocalDate.of(2026, 8, 14), "17:30", "20:00", 2.5, "Month-end financial balance sheet preparation", LeaveStatus.Approved),
                    new OtSeed("EMP-012", LocalDate.of(2026, 8, 25), "17:30", "19:30", 2.0, "Prepare Q3 marketing promotional campaign", LeaveStatus.Pending)
            );

            for (OtSeed ot : otSeeds) {
                overtimeRepository.save(Overtime.builder()
                        .staffId(ot.staffId())
                        .fromDate(ot.date())
                        .toDate(ot.date())
                        .startTime(ot.start())
                        .endTime(ot.end())
                        .amountDay(BigDecimal.valueOf(ot.hrs()))
                        .reason(ot.reason())
                        .status(ot.status())
                        .managerName("Admin")
                        .createdBy("Admin")
                        .requestedAt(ot.date().atTime(17, 0))
                        .approvedAt(ot.status() == LeaveStatus.Approved ? ot.date().atTime(17, 30) : null)
                        .build());
            }
        }

        log.info("2 months attendance, leaves, and overtime seeding completed.");
    }
}
