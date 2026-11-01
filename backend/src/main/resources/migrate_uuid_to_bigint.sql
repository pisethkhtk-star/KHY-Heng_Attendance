-- ==============================================================================
-- Migration Script: Convert UUID Primary Keys and Foreign Keys to BIGINT (BIGSERIAL)
-- Database: PostgreSQL (khyheng_att)
-- ==============================================================================

-- NOTE:
-- Option A: If this is development/test environment and you can recreate tables:
-- You can simply set 'spring.jpa.hibernate.ddl-auto: update' in application.yml once,
-- or drop the tables and let Hibernate regenerate them.

-- Option B: If you need to alter existing tables in PostgreSQL:

BEGIN;

-- 1. Departments & Positions
-- -------------------------------------------------------------
ALTER TABLE IF EXISTS departments 
    DROP CONSTRAINT IF EXISTS departments_pkey CASCADE;
ALTER TABLE IF EXISTS departments 
    DROP COLUMN IF EXISTS id CASCADE;
ALTER TABLE IF EXISTS departments 
    ADD COLUMN id BIGSERIAL PRIMARY KEY;

ALTER TABLE IF EXISTS positions 
    DROP CONSTRAINT IF EXISTS positions_pkey CASCADE;
ALTER TABLE IF EXISTS positions 
    DROP COLUMN IF EXISTS id CASCADE;
ALTER TABLE IF EXISTS positions 
    ADD COLUMN id BIGSERIAL PRIMARY KEY;
ALTER TABLE IF EXISTS positions 
    DROP COLUMN IF EXISTS department_id;
ALTER TABLE IF EXISTS positions 
    ADD COLUMN department_id BIGINT;

-- 2. Roles & Permissions
-- -------------------------------------------------------------
ALTER TABLE IF EXISTS roles 
    DROP CONSTRAINT IF EXISTS roles_pkey CASCADE;
ALTER TABLE IF EXISTS roles 
    DROP COLUMN IF EXISTS id CASCADE;
ALTER TABLE IF EXISTS roles 
    ADD COLUMN id BIGSERIAL PRIMARY KEY;

ALTER TABLE IF EXISTS user_roles 
    DROP COLUMN IF EXISTS user_id,
    DROP COLUMN IF EXISTS role_id;
ALTER TABLE IF EXISTS user_roles 
    ADD COLUMN user_id BIGINT,
    ADD COLUMN role_id BIGINT;

ALTER TABLE IF EXISTS role_permissions 
    DROP CONSTRAINT IF EXISTS role_permissions_pkey CASCADE;
ALTER TABLE IF EXISTS role_permissions 
    DROP COLUMN IF EXISTS id CASCADE;
ALTER TABLE IF EXISTS role_permissions 
    ADD COLUMN id BIGSERIAL PRIMARY KEY;
ALTER TABLE IF EXISTS role_permissions 
    DROP COLUMN IF EXISTS role_id;
ALTER TABLE IF EXISTS role_permissions 
    ADD COLUMN role_id BIGINT;

-- 3. Employees
-- -------------------------------------------------------------
ALTER TABLE IF EXISTS employees 
    DROP CONSTRAINT IF EXISTS employees_pkey CASCADE;
ALTER TABLE IF EXISTS employees 
    DROP COLUMN IF EXISTS id CASCADE;
ALTER TABLE IF EXISTS employees 
    ADD COLUMN id BIGSERIAL PRIMARY KEY;
ALTER TABLE IF EXISTS employees 
    DROP COLUMN IF EXISTS position_id,
    DROP COLUMN IF EXISTS department_id,
    DROP COLUMN IF EXISTS role_id;
ALTER TABLE IF EXISTS employees 
    ADD COLUMN position_id BIGINT,
    ADD COLUMN department_id BIGINT,
    ADD COLUMN role_id BIGINT;

-- 4. Attendances & Attendance Logs
-- -------------------------------------------------------------
ALTER TABLE IF EXISTS attendances 
    DROP CONSTRAINT IF EXISTS attendances_pkey CASCADE;
ALTER TABLE IF EXISTS attendances 
    DROP COLUMN IF EXISTS id CASCADE;
ALTER TABLE IF EXISTS attendances 
    ADD COLUMN id BIGSERIAL PRIMARY KEY;

ALTER TABLE IF EXISTS attendance_logs 
    DROP CONSTRAINT IF EXISTS attendance_logs_pkey CASCADE;
ALTER TABLE IF EXISTS attendance_logs 
    DROP COLUMN IF EXISTS id CASCADE;
ALTER TABLE IF EXISTS attendance_logs 
    ADD COLUMN id BIGSERIAL PRIMARY KEY;

-- 5. Leaves & Approvals
-- -------------------------------------------------------------
ALTER TABLE IF EXISTS leaves 
    DROP CONSTRAINT IF EXISTS leaves_pkey CASCADE;
ALTER TABLE IF EXISTS leaves 
    DROP COLUMN IF EXISTS id CASCADE;
ALTER TABLE IF EXISTS leaves 
    ADD COLUMN id BIGSERIAL PRIMARY KEY;

ALTER TABLE IF EXISTS leave_types 
    DROP CONSTRAINT IF EXISTS leave_types_pkey CASCADE;
ALTER TABLE IF EXISTS leave_types 
    DROP COLUMN IF EXISTS id CASCADE;
ALTER TABLE IF EXISTS leave_types 
    ADD COLUMN id BIGSERIAL PRIMARY KEY;

ALTER TABLE IF EXISTS employee_leave_limits 
    DROP CONSTRAINT IF EXISTS employee_leave_limits_pkey CASCADE;
ALTER TABLE IF EXISTS employee_leave_limits 
    DROP COLUMN IF EXISTS id CASCADE;
ALTER TABLE IF EXISTS employee_leave_limits 
    ADD COLUMN id BIGSERIAL PRIMARY KEY;

ALTER TABLE IF EXISTS leave_approval_rules 
    DROP CONSTRAINT IF EXISTS leave_approval_rules_pkey CASCADE;
ALTER TABLE IF EXISTS leave_approval_rules 
    DROP COLUMN IF EXISTS id CASCADE;
ALTER TABLE IF EXISTS leave_approval_rules 
    ADD COLUMN id BIGSERIAL PRIMARY KEY;
ALTER TABLE IF EXISTS leave_approval_rules 
    DROP COLUMN IF EXISTS target_dept_id;
ALTER TABLE IF EXISTS leave_approval_rules 
    ADD COLUMN target_dept_id BIGINT;

-- 6. Overtimes & Kiosk Settings
-- -------------------------------------------------------------
ALTER TABLE IF EXISTS overtimes 
    DROP CONSTRAINT IF EXISTS overtimes_pkey CASCADE;
ALTER TABLE IF EXISTS overtimes 
    DROP COLUMN IF EXISTS id CASCADE;
ALTER TABLE IF EXISTS overtimes 
    ADD COLUMN id BIGSERIAL PRIMARY KEY;
ALTER TABLE IF EXISTS overtimes 
    DROP COLUMN IF EXISTS branch_id;
ALTER TABLE IF EXISTS overtimes 
    ADD COLUMN branch_id BIGINT;

ALTER TABLE IF EXISTS kiosk_settings 
    DROP CONSTRAINT IF EXISTS kiosk_settings_pkey CASCADE;
ALTER TABLE IF EXISTS kiosk_settings 
    DROP COLUMN IF EXISTS id CASCADE;
ALTER TABLE IF EXISTS kiosk_settings 
    ADD COLUMN id BIGSERIAL PRIMARY KEY;

ALTER TABLE IF EXISTS company_work_hours 
    DROP CONSTRAINT IF EXISTS company_work_hours_pkey CASCADE;
ALTER TABLE IF EXISTS company_work_hours 
    DROP COLUMN IF EXISTS id CASCADE;
ALTER TABLE IF EXISTS company_work_hours 
    ADD COLUMN id BIGSERIAL PRIMARY KEY;

-- 7. Payroll & Payslips
-- -------------------------------------------------------------
ALTER TABLE IF EXISTS payroll_runs 
    DROP CONSTRAINT IF EXISTS payroll_runs_pkey CASCADE;
ALTER TABLE IF EXISTS payroll_runs 
    DROP COLUMN IF EXISTS id CASCADE;
ALTER TABLE IF EXISTS payroll_runs 
    ADD COLUMN id BIGSERIAL PRIMARY KEY;

ALTER TABLE IF EXISTS payslips 
    DROP CONSTRAINT IF EXISTS payslips_pkey CASCADE;
ALTER TABLE IF EXISTS payslips 
    DROP COLUMN IF EXISTS id CASCADE;
ALTER TABLE IF EXISTS payslips 
    ADD COLUMN id BIGSERIAL PRIMARY KEY;
ALTER TABLE IF EXISTS payslips 
    DROP COLUMN IF EXISTS payroll_run_id;
ALTER TABLE IF EXISTS payslips 
    ADD COLUMN payroll_run_id BIGINT;

ALTER TABLE IF EXISTS employee_salary_profiles 
    DROP CONSTRAINT IF EXISTS employee_salary_profiles_pkey CASCADE;
ALTER TABLE IF EXISTS employee_salary_profiles 
    DROP COLUMN IF EXISTS id CASCADE;
ALTER TABLE IF EXISTS employee_salary_profiles 
    ADD COLUMN id BIGSERIAL PRIMARY KEY;

ALTER TABLE IF EXISTS nssf_configs 
    DROP CONSTRAINT IF EXISTS nssf_configs_pkey CASCADE;
ALTER TABLE IF EXISTS nssf_configs 
    DROP COLUMN IF EXISTS id CASCADE;
ALTER TABLE IF EXISTS nssf_configs 
    ADD COLUMN id BIGSERIAL PRIMARY KEY;

ALTER TABLE IF EXISTS tax_brackets 
    DROP CONSTRAINT IF EXISTS tax_brackets_pkey CASCADE;
ALTER TABLE IF EXISTS tax_brackets 
    DROP COLUMN IF EXISTS id CASCADE;
ALTER TABLE IF EXISTS tax_brackets 
    ADD COLUMN id BIGSERIAL PRIMARY KEY;

-- 8. Biometrics & Notifications & Settings
-- -------------------------------------------------------------
ALTER TABLE IF EXISTS employee_face_data 
    DROP CONSTRAINT IF EXISTS employee_face_data_pkey CASCADE;
ALTER TABLE IF EXISTS employee_face_data 
    DROP COLUMN IF EXISTS id CASCADE;
ALTER TABLE IF EXISTS employee_face_data 
    ADD COLUMN id BIGSERIAL PRIMARY KEY;

ALTER TABLE IF EXISTS employee_qr_codes 
    DROP CONSTRAINT IF EXISTS employee_qr_codes_pkey CASCADE;
ALTER TABLE IF EXISTS employee_qr_codes 
    DROP COLUMN IF EXISTS id CASCADE;
ALTER TABLE IF EXISTS employee_qr_codes 
    ADD COLUMN id BIGSERIAL PRIMARY KEY;

ALTER TABLE IF EXISTS notifications 
    DROP CONSTRAINT IF EXISTS notifications_pkey CASCADE;
ALTER TABLE IF EXISTS notifications 
    DROP COLUMN IF EXISTS id CASCADE;
ALTER TABLE IF EXISTS notifications 
    ADD COLUMN id BIGSERIAL PRIMARY KEY;

ALTER TABLE IF EXISTS push_notification_campaigns 
    DROP CONSTRAINT IF EXISTS push_notification_campaigns_pkey CASCADE;
ALTER TABLE IF EXISTS push_notification_campaigns 
    DROP COLUMN IF EXISTS id CASCADE;
ALTER TABLE IF EXISTS push_notification_campaigns 
    ADD COLUMN id BIGSERIAL PRIMARY KEY;
ALTER TABLE IF EXISTS push_notification_campaigns 
    DROP COLUMN IF EXISTS target_department_id;
ALTER TABLE IF EXISTS push_notification_campaigns 
    ADD COLUMN target_department_id BIGINT;

ALTER TABLE IF EXISTS telegram_settings 
    DROP CONSTRAINT IF EXISTS telegram_settings_pkey CASCADE;
ALTER TABLE IF EXISTS telegram_settings 
    DROP COLUMN IF EXISTS id CASCADE;
ALTER TABLE IF EXISTS telegram_settings 
    ADD COLUMN id BIGSERIAL PRIMARY KEY;

COMMIT;

