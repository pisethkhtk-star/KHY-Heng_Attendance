package com.hrchomnan.backend.util;

import com.hrchomnan.backend.model.Attendance;
import com.hrchomnan.backend.model.CompanyWorkHour;
import com.hrchomnan.backend.model.Employee;
import com.hrchomnan.backend.repository.AttendanceRepository;
import com.hrchomnan.backend.repository.CompanyWorkHourRepository;
import com.hrchomnan.backend.repository.EmployeeRepository;
import com.hrchomnan.backend.service.TelegramNotificationService;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;

@Slf4j
@Component
@Transactional
@RequiredArgsConstructor
public class AttendanceHelper {

    private static final ZoneId CAMBODIA_ZONE = ZoneId.of("Asia/Phnom_Penh");
    private final AttendanceRepository attendanceRepository;
    private final EmployeeRepository employeeRepository;
    private final CompanyWorkHourRepository companyWorkHourRepository;
    private final TelegramNotificationService telegramNotificationService;

    @Data
    @Builder
    public static class TimeDetails {
        private LocalDate date;
        private String dateString;
        private String timeString;
    }

    @Data
    @Builder
    public static class ScanResult {
        private Attendance attendance;
        private Employee employee;
        private String action;
        private String timeString;
        private String dateString;
    }

    public TimeDetails getLocalTimeDetails(String customTime, String customDate) {
        ZonedDateTime cambodiaNow = ZonedDateTime.now(CAMBODIA_ZONE);

        LocalDate date;
        if (customDate != null && !customDate.isBlank()) {
            date = LocalDate.parse(customDate.trim());
        } else {
            date = cambodiaNow.toLocalDate();
        }

        String timeString;
        if (customTime != null && !customTime.isBlank()) {
            timeString = customTime.trim();
        } else {
            timeString = cambodiaNow.toLocalTime().format(DateTimeFormatter.ofPattern("HH:mm"));
        }

        return TimeDetails.builder()
                .date(date)
                .dateString(date.toString())
                .timeString(timeString)
                .build();
    }

    public int timeToMinutes(String timeStr) {
        if (timeStr == null || !timeStr.contains(":")) return 0;
        try {
            String[] parts = timeStr.trim().split(":");
            int h = Integer.parseInt(parts[0]);
            int m = Integer.parseInt(parts[1]);
            return h * 60 + m;
        } catch (Exception e) {
            return 0;
        }
    }

    public String determineAutoAction(Employee employee, Attendance existingAttendance, String timeString) {
        int currentMinutes = timeToMinutes(timeString);
        int s1StartMinutes = timeToMinutes(employee != null && employee.getShift1Start() != null ? employee.getShift1Start() : "08:00");
        int s1EndMinutes = timeToMinutes(employee != null && employee.getShift1End() != null ? employee.getShift1End() : "12:00");
        int s2StartMinutes = timeToMinutes(employee != null && employee.getShift2Start() != null ? employee.getShift2Start() : "13:00");
        int s2EndMinutes = timeToMinutes(employee != null && employee.getShift2End() != null ? employee.getShift2End() : "17:00");

        String checkin1 = existingAttendance != null ? existingAttendance.getCheckin1() : null;
        String checkout1 = existingAttendance != null ? existingAttendance.getCheckout1() : null;
        String checkin2 = existingAttendance != null ? existingAttendance.getCheckin2() : null;
        String checkout2 = existingAttendance != null ? existingAttendance.getCheckout2() : null;

        boolean hasCheckIn1 = checkin1 != null && !checkin1.isBlank() && !checkin1.equals("--:--") && !checkin1.equals("-");
        boolean hasCheckOut1 = checkout1 != null && !checkout1.isBlank() && !checkout1.equals("--:--") && !checkout1.equals("-");
        boolean hasCheckIn2 = checkin2 != null && !checkin2.isBlank() && !checkin2.equals("--:--") && !checkin2.equals("-");
        boolean hasCheckOut2 = checkout2 != null && !checkout2.isBlank() && !checkout2.equals("--:--") && !checkout2.equals("-");

        // 1. IF (currentTime < s1_end):
        if (currentMinutes < s1EndMinutes) {
            if (!hasCheckIn1) return "checkin_1";
            else return "completed";
        }
        // 2. ELSE IF (currentTime >= s1EndMinutes AND currentTime < s2EndMinutes):
        else if (currentMinutes >= s1EndMinutes && currentMinutes < s2EndMinutes) {
            // ករណីភ្លេច Check-out វេនព្រឹក (ដល់/ហួសម៉ោង s1_end)
            if (hasCheckIn1 && !hasCheckOut1) return "checkout_1";
            // ករណីវេនព្រឹកចប់សព្វគ្រប់ ហើយចូលវេនរសៀល
            else if (!hasCheckIn2) return "checkin_2";
            else return "completed";
        }
        // 3. ELSE IF (currentTime >= s2_end):
        else {
            // ករណីដល់/ហួសម៉ោងវេនរសៀល
            if (hasCheckIn2 && !hasCheckOut2) return "checkout_2";
            else return "completed";
        }
    }

    public ScanResult processAttendanceScan(String staffId, String requestedAction, String customTime, String customDate, String note) {
        Optional<Employee> empOpt = employeeRepository.findByStaffId(staffId);
        if (empOpt.isEmpty()) {
            throw new RuntimeException("Employee not found");
        }
        Employee employee = empOpt.get();

        TimeDetails timeDetails = getLocalTimeDetails(customTime, customDate);
        LocalDate attendanceDate = timeDetails.getDate();
        String timeString = timeDetails.getTimeString();

        Optional<Attendance> existingOpt = attendanceRepository.findByStaffIdAndAttendanceDate(staffId, attendanceDate);
        boolean hadCheckout2Already = existingOpt.isPresent() &&
                existingOpt.get().getCheckout2() != null &&
                !existingOpt.get().getCheckout2().isBlank() &&
                !existingOpt.get().getCheckout2().equals("--:--") &&
                !existingOpt.get().getCheckout2().equals("-");

        Attendance attendance = existingOpt.orElseGet(() -> Attendance.builder()
                .staffId(staffId)
                .attendanceDate(attendanceDate)
                .build());

        String action;
        if (hadCheckout2Already) {
            action = "completed";
        } else {
            action = (requestedAction != null && !requestedAction.isBlank())
                    ? requestedAction
                    : determineAutoAction(employee, attendance, timeString);
        }

        if (note != null && !note.isBlank()) {
            attendance.setNote(note);
        }

        switch (action) {
            case "checkin_1" -> attendance.setCheckin1(timeString);
            case "checkout_1" -> attendance.setCheckout1(timeString);
            case "checkin_2" -> attendance.setCheckin2(timeString);
            case "checkout_2" -> attendance.setCheckout2(timeString);
        }

        // Recalculate late and early leave metrics
        String c1 = attendance.getCheckin1();
        String c2 = attendance.getCheckin2();
        String o1 = attendance.getCheckout1();
        String o2 = attendance.getCheckout2();

        String s1Start = (employee.getShift1Start() != null && !employee.getShift1Start().isBlank()) ? employee.getShift1Start() : "08:00";
        String s1End = (employee.getShift1End() != null && !employee.getShift1End().isBlank()) ? employee.getShift1End() : "12:00";
        String s2Start = (employee.getShift2Start() != null && !employee.getShift2Start().isBlank()) ? employee.getShift2Start() : "13:00";
        String s2End = (employee.getShift2End() != null && !employee.getShift2End().isBlank()) ? employee.getShift2End() : "17:00";

        int graceMinutes = 0;
        List<CompanyWorkHour> cwhList = companyWorkHourRepository.findAll();
        if (!cwhList.isEmpty() && cwhList.get(0).getLateGraceMinutes() != null) {
            graceMinutes = cwhList.get(0).getLateGraceMinutes();
        }

        int s1StartMin = timeToMinutes(s1Start) + graceMinutes;
        int s1EndMin = timeToMinutes(s1End);
        int s2StartMin = timeToMinutes(s2Start) + graceMinutes;
        int s2EndMin = timeToMinutes(s2End);

        boolean isLate = false;
        boolean isEarlyLeave = false;

        if (c1 != null && !c1.isBlank() && timeToMinutes(c1) > s1StartMin) isLate = true;
        if (c2 != null && !c2.isBlank() && timeToMinutes(c2) > s2StartMin) isLate = true;
        if (o1 != null && !o1.isBlank() && timeToMinutes(o1) < s1EndMin) isEarlyLeave = true;
        if (o2 != null && !o2.isBlank() && timeToMinutes(o2) < s2EndMin) isEarlyLeave = true;

        attendance.setIsLate(isLate);
        attendance.setIsEarlyLeave(isEarlyLeave);

        Attendance savedAttendance = attendanceRepository.save(attendance);

        // Send instant notification to Telegram Group ONLY if shift out 2 did not already have data
        if (!hadCheckout2Already && !"completed".equalsIgnoreCase(action)) {
            telegramNotificationService.sendAttendanceNotification(
                    employee,
                    savedAttendance,
                    action,
                    timeString,
                    null,
                    note
            );
        } else {
            log.info("Skipping Telegram notification for staffId {} - shift out 2 already has data for today or action is completed.", staffId);
        }

        return ScanResult.builder()
                .attendance(savedAttendance)
                .employee(employee)
                .action(action)
                .timeString(timeString)
                .dateString(timeDetails.getDateString())
                .build();
    }
}
