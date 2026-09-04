-- PostgreSQL function and trigger to automatically cascade delete all related data when an employee is deleted
CREATE OR REPLACE FUNCTION cascade_delete_employee_data()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.staff_id IS NOT NULL AND OLD.staff_id != '' THEN
        -- 1. Delete all attendance records
        DELETE FROM attendances WHERE staff_id = OLD.staff_id;
        
        -- 2. Delete all attendance scan logs
        DELETE FROM attendance_logs WHERE staff_id = OLD.staff_id;
        
        -- 3. Delete all leave requests
        DELETE FROM leaves WHERE staff_id = OLD.staff_id;
        
        -- 4. Delete all overtime requests
        DELETE FROM overtimes WHERE staff_id = OLD.staff_id;
        
        -- 5. Clear manager references in remaining overtime records
        UPDATE overtimes SET manager_id = NULL, manager_name = NULL WHERE manager_id = OLD.staff_id;
        
        -- 6. Delete custom leave limits
        DELETE FROM employee_leave_limits WHERE staff_id = OLD.staff_id;
        
        -- 7. Delete face biometric data
        DELETE FROM employee_face_data WHERE staff_id = OLD.staff_id;
        
        -- 8. Delete employee QR codes
        DELETE FROM employee_qr_codes WHERE staff_id = OLD.staff_id;
        
        -- 9. Delete approval rules where employee is target or approver
        DELETE FROM leave_approval_rules WHERE approver_id = OLD.staff_id OR target_staff_id = OLD.staff_id;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cascade_delete_employee ON employees;
CREATE TRIGGER trg_cascade_delete_employee
BEFORE DELETE ON employees
FOR EACH ROW
EXECUTE FUNCTION cascade_delete_employee_data();
