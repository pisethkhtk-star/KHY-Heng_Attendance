-- Update working days for all employees to Monday through Saturday [1, 2, 3, 4, 5, 6]
UPDATE employees
SET flexible_schedule = 
    CASE 
        WHEN flexible_schedule IS NULL OR flexible_schedule = '' OR flexible_schedule = '{}' 
        THEN '{"workingDays":[1,2,3,4,5,6]}'
        ELSE (flexible_schedule::jsonb || '{"workingDays":[1,2,3,4,5,6]}'::jsonb)::text
    END;

-- Also ensure company_work_hours default is Monday through Saturday
UPDATE company_work_hours
SET flexible_schedule = 
    CASE 
        WHEN flexible_schedule IS NULL OR flexible_schedule = '' OR flexible_schedule = '{}' 
        THEN '{"workingDays":[1,2,3,4,5,6]}'
        ELSE (flexible_schedule::jsonb || '{"workingDays":[1,2,3,4,5,6]}'::jsonb)::text
    END;
