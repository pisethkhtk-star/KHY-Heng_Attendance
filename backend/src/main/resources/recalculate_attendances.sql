-- Recalculate is_late and is_early_leave for all attendances based on employee shifts and grace period (15m)
WITH calc AS (
    SELECT 
        a.id,
        CASE 
            WHEN (a.checkin_1 IS NOT NULL AND a.checkin_1 != '' AND a.checkin_1 != '-' AND 
                  (CAST(SPLIT_PART(a.checkin_1, ':', 1) AS INTEGER) * 60 + CAST(SPLIT_PART(a.checkin_1, ':', 2) AS INTEGER)) > 
                  (CAST(SPLIT_PART(COALESCE(e.shift_1_start, '08:00'), ':', 1) AS INTEGER) * 60 + CAST(SPLIT_PART(COALESCE(e.shift_1_start, '08:00'), ':', 2) AS INTEGER) + 15))
                 OR
                 (a.checkin_2 IS NOT NULL AND a.checkin_2 != '' AND a.checkin_2 != '-' AND 
                  (CAST(SPLIT_PART(a.checkin_2, ':', 1) AS INTEGER) * 60 + CAST(SPLIT_PART(a.checkin_2, ':', 2) AS INTEGER)) > 
                  (CAST(SPLIT_PART(COALESCE(e.shift_2_start, '13:00'), ':', 1) AS INTEGER) * 60 + CAST(SPLIT_PART(COALESCE(e.shift_2_start, '13:00'), ':', 2) AS INTEGER) + 15))
            THEN true ELSE false
        END AS new_is_late,
        CASE 
            WHEN (a.checkout_1 IS NOT NULL AND a.checkout_1 != '' AND a.checkout_1 != '-' AND 
                  (CAST(SPLIT_PART(a.checkout_1, ':', 1) AS INTEGER) * 60 + CAST(SPLIT_PART(a.checkout_1, ':', 2) AS INTEGER)) < 
                  (CAST(SPLIT_PART(COALESCE(e.shift_1_end, '12:00'), ':', 1) AS INTEGER) * 60 + CAST(SPLIT_PART(COALESCE(e.shift_1_end, '12:00'), ':', 2) AS INTEGER)))
                 OR
                 (a.checkout_2 IS NOT NULL AND a.checkout_2 != '' AND a.checkout_2 != '-' AND 
                  (CAST(SPLIT_PART(a.checkout_2, ':', 1) AS INTEGER) * 60 + CAST(SPLIT_PART(a.checkout_2, ':', 2) AS INTEGER)) < 
                  (CAST(SPLIT_PART(COALESCE(e.shift_2_end, '17:00'), ':', 1) AS INTEGER) * 60 + CAST(SPLIT_PART(COALESCE(e.shift_2_end, '17:00'), ':', 2) AS INTEGER)))
            THEN true ELSE false
        END AS new_is_early_leave
    FROM attendances a
    LEFT JOIN employees e ON a.staff_id = e.staff_id
)
UPDATE attendances a
SET 
    is_late = calc.new_is_late,
    is_early_leave = calc.new_is_early_leave
FROM calc
WHERE a.id = calc.id;
