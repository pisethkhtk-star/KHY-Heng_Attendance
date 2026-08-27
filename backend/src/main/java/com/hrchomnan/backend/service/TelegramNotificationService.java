package com.hrchomnan.backend.service;

import com.hrchomnan.backend.model.Attendance;
import com.hrchomnan.backend.model.CompanyWorkHour;
import com.hrchomnan.backend.model.Department;
import com.hrchomnan.backend.model.Employee;
import com.hrchomnan.backend.model.Position;
import com.hrchomnan.backend.model.TelegramSetting;
import com.hrchomnan.backend.repository.CompanyWorkHourRepository;
import com.hrchomnan.backend.repository.DepartmentRepository;
import com.hrchomnan.backend.repository.PositionRepository;
import com.hrchomnan.backend.repository.TelegramSettingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;

@Service
@RequiredArgsConstructor
@Slf4j
public class TelegramNotificationService {

    private final TelegramSettingRepository telegramSettingRepository;
    private final CompanyWorkHourRepository companyWorkHourRepository;
    private final DepartmentRepository departmentRepository;
    private final PositionRepository positionRepository;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    public void sendAttendanceNotification(
            Employee employee,
            Attendance attendance,
            String action,
            String timeString,
            String location,
            String note
    ) {
        CompletableFuture.runAsync(() -> {
            try {
                List<TelegramSetting> settingsList = telegramSettingRepository.findAll();
                if (settingsList.isEmpty()) return;

                TelegramSetting setting = settingsList.get(0);
                if (setting.getIsEnabled() == null || !setting.getIsEnabled()) return;
                if (setting.getBotToken() == null || setting.getBotToken().isBlank()) return;
                if (setting.getChatId() == null || setting.getChatId().isBlank()) return;

                boolean isCheckin = action != null && action.startsWith("checkin");
                boolean isCheckout = action != null && action.startsWith("checkout");

                if (isCheckin && setting.getSendOnCheckin() != null && !setting.getSendOnCheckin()) {
                    return;
                }
                if (isCheckout && setting.getSendOnCheckout() != null && !setting.getSendOnCheckout()) {
                    return;
                }

                boolean isLate = attendance != null && Boolean.TRUE.equals(attendance.getIsLate());
                if (Boolean.TRUE.equals(setting.getSendOnlyLate()) && !isLate) {
                    return;
                }

                String messageText = buildAttendanceMessage(employee, attendance, action, timeString, location, note);
                sendTelegramMessage(setting.getBotToken(), setting.getChatId(), messageText);
            } catch (Exception e) {
                log.error("Failed to send Telegram attendance notification: {}", e.getMessage());
            }
        });
    }

    public void sendLeaveRequestNotification(
            Employee employee,
            String leaveType,
            String dateRangeStr,
            String durationType,
            Double totalDays,
            String reason
    ) {
        CompletableFuture.runAsync(() -> {
            try {
                List<TelegramSetting> settingsList = telegramSettingRepository.findAll();
                if (settingsList.isEmpty()) return;

                TelegramSetting setting = settingsList.get(0);
                if (setting.getLeaveEnabled() == null || !setting.getLeaveEnabled()) return;
                if (setting.getSendOnLeaveRequest() != null && !setting.getSendOnLeaveRequest()) return;

                String token = (setting.getLeaveBotToken() != null && !setting.getLeaveBotToken().isBlank())
                        ? setting.getLeaveBotToken()
                        : setting.getBotToken();
                String chat = (setting.getLeaveChatId() != null && !setting.getLeaveChatId().isBlank())
                        ? setting.getLeaveChatId()
                        : setting.getChatId();

                if (token == null || token.isBlank() || chat == null || chat.isBlank()) return;

                String messageText = buildLeaveRequestMessage(employee, leaveType, dateRangeStr, durationType, totalDays, reason);
                sendTelegramMessage(token, chat, messageText);
            } catch (Exception e) {
                log.error("Failed to send Telegram leave request notification: {}", e.getMessage());
            }
        });
    }

    public void sendLeaveApprovalNotification(
            Employee employee,
            String leaveType,
            String dateStr,
            String newStatus,
            String approverName,
            String reason
    ) {
        CompletableFuture.runAsync(() -> {
            try {
                List<TelegramSetting> settingsList = telegramSettingRepository.findAll();
                if (settingsList.isEmpty()) return;

                TelegramSetting setting = settingsList.get(0);
                if (setting.getLeaveEnabled() == null || !setting.getLeaveEnabled()) return;
                if (setting.getSendOnLeaveApproval() != null && !setting.getSendOnLeaveApproval()) return;

                String token = (setting.getLeaveBotToken() != null && !setting.getLeaveBotToken().isBlank())
                        ? setting.getLeaveBotToken()
                        : setting.getBotToken();
                String chat = (setting.getLeaveChatId() != null && !setting.getLeaveChatId().isBlank())
                        ? setting.getLeaveChatId()
                        : setting.getChatId();

                if (token == null || token.isBlank() || chat == null || chat.isBlank()) return;

                String messageText = buildLeaveApprovalMessage(employee, leaveType, dateStr, newStatus, approverName, reason);
                sendTelegramMessage(token, chat, messageText);
            } catch (Exception e) {
                log.error("Failed to send Telegram leave approval notification: {}", e.getMessage());
            }
        });
    }

    public boolean sendTestMessage(String botToken, String chatId) {
        try {
            String testMsg = """
                    🚀 <b>HR Attendance System - Telegram Test</b>
                    ━━━━━━━━━━━━━━━━━━━━━━━
                    ✅ <b>Status:</b> Connected Successfully!
                    📅 <b>Time:</b> %s
                    🏢 <b>Channel:</b> Attendance Alerts
                    ━━━━━━━━━━━━━━━━━━━━━━━
                    <i>Telegram notifications are now active for Check-In and Check-Out events.</i>
                    """.formatted(java.time.LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd-MM-yyyy HH:mm:ss")));

            return sendTelegramMessageSync(botToken, chatId, testMsg);
        } catch (Exception e) {
            log.error("Failed to send test Telegram message: {}", e.getMessage());
            return false;
        }
    }

    public boolean sendTestLeaveMessage(String botToken, String chatId) {
        try {
            String testMsg = """
                    🌴 <b>HR Attendance System - Leave Channel Test</b>
                    ━━━━━━━━━━━━━━━━━━━━━━━
                    ✅ <b>Status:</b> Connected Successfully!
                    📅 <b>Time:</b> %s
                    🏢 <b>Channel:</b> Leave Requests & Approvals
                    ━━━━━━━━━━━━━━━━━━━━━━━
                    <i>Telegram notifications are now active for Employee Leave requests and approvals.</i>
                    """.formatted(java.time.LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd-MM-yyyy HH:mm:ss")));

            return sendTelegramMessageSync(botToken, chatId, testMsg);
        } catch (Exception e) {
            log.error("Failed to send test Telegram leave message: {}", e.getMessage());
            return false;
        }
    }

    private String buildLeaveRequestMessage(
            Employee employee,
            String leaveType,
            String dateRangeStr,
            String durationType,
            Double totalDays,
            String reason
    ) {
        String empNameEn = employee != null && employee.getNameEn() != null ? employee.getNameEn() : "Unknown";
        String empNameKh = employee != null && employee.getNameKh() != null ? employee.getNameKh() : "";
        String staffId = employee != null && employee.getStaffId() != null ? employee.getStaffId() : "N/A";

        String dept = "-";
        if (employee != null && employee.getDepartmentId() != null) {
            Optional<Department> dOpt = departmentRepository.findById(employee.getDepartmentId());
            if (dOpt.isPresent() && dOpt.get().getNameEn() != null) {
                dept = dOpt.get().getNameEn();
            }
        }

        String pos = "-";
        if (employee != null && employee.getPositionId() != null) {
            Optional<Position> pOpt = positionRepository.findById(employee.getPositionId());
            if (pOpt.isPresent() && pOpt.get().getTitleEn() != null) {
                pos = pOpt.get().getTitleEn();
            }
        }

        StringBuilder sb = new StringBuilder();
        sb.append("🌴 <b>NEW LEAVE REQUEST (ស្នើសុំច្បាប់)</b>\n");
        sb.append("━━━━━━━━━━━━━━━━━━━━━━━\n");
        sb.append("👤 <b>Employee:</b> ").append(empNameEn);
        if (!empNameKh.isBlank()) {
            sb.append(" (").append(empNameKh).append(")");
        }
        sb.append("\n");
        sb.append("🆔 <b>Staff ID:</b> <code>").append(staffId).append("</code>\n");
        sb.append("🏢 <b>Department:</b> ").append(dept).append("\n");
        sb.append("💼 <b>Position:</b> ").append(pos).append("\n");
        sb.append("📋 <b>Leave Type:</b> <b>").append(leaveType != null ? leaveType : "General Leave").append("</b>\n");
        sb.append("📅 <b>Period:</b> ").append(dateRangeStr != null ? dateRangeStr : "-");
        if (totalDays != null && totalDays > 0) {
            sb.append(" (").append(totalDays).append(" Day").append(totalDays > 1 ? "s" : "").append(")");
        }
        sb.append("\n");
        if (durationType != null && !durationType.isBlank()) {
            sb.append("⏱️ <b>Duration:</b> ").append(durationType).append("\n");
        }
        if (reason != null && !reason.isBlank()) {
            sb.append("📝 <b>Reason:</b> <i>").append(escapeHtml(reason)).append("</i>\n");
        }
        sb.append("⏳ <b>Status:</b> 🟡 <b>Pending Approval</b>\n");
        sb.append("━━━━━━━━━━━━━━━━━━━━━━━\n");

        return sb.toString();
    }

    private String buildLeaveApprovalMessage(
            Employee employee,
            String leaveType,
            String dateStr,
            String newStatus,
            String approverName,
            String reason
    ) {
        String empNameEn = employee != null && employee.getNameEn() != null ? employee.getNameEn() : "Unknown";
        String empNameKh = employee != null && employee.getNameKh() != null ? employee.getNameKh() : "";
        String staffId = employee != null && employee.getStaffId() != null ? employee.getStaffId() : "N/A";

        boolean isApproved = "Approved".equalsIgnoreCase(newStatus);
        String statusIcon = isApproved ? "✅" : "❌";
        String statusHeader = isApproved ? "LEAVE REQUEST APPROVED (បានអនុម័ត)" : "LEAVE REQUEST REJECTED (បដិសេធ)";
        String statusDisplay = isApproved ? "🟢 <b>Approved</b>" : "🔴 <b>Rejected</b>";

        StringBuilder sb = new StringBuilder();
        sb.append(statusIcon).append(" <b>").append(statusHeader).append("</b>\n");
        sb.append("━━━━━━━━━━━━━━━━━━━━━━━\n");
        sb.append("👤 <b>Employee:</b> ").append(empNameEn);
        if (!empNameKh.isBlank()) {
            sb.append(" (").append(empNameKh).append(")");
        }
        sb.append("\n");
        sb.append("🆔 <b>Staff ID:</b> <code>").append(staffId).append("</code>\n");
        sb.append("📋 <b>Leave Type:</b> <b>").append(leaveType != null ? leaveType : "Leave").append("</b>\n");
        sb.append("📅 <b>Date:</b> ").append(dateStr != null ? dateStr : "-").append("\n");
        if (approverName != null && !approverName.isBlank()) {
            sb.append("👨‍💼 <b>Decided By:</b> ").append(approverName).append("\n");
        }
        sb.append("📊 <b>Status:</b> ").append(statusDisplay).append("\n");
        if (reason != null && !reason.isBlank()) {
            sb.append("📝 <b>Note / Reason:</b> <i>").append(escapeHtml(reason)).append("</i>\n");
        }
        sb.append("━━━━━━━━━━━━━━━━━━━━━━━\n");

        return sb.toString();
    }

    private String buildAttendanceMessage(
            Employee employee,
            Attendance attendance,
            String action,
            String timeString,
            String location,
            String note
    ) {
        String empNameEn = employee != null && employee.getNameEn() != null ? employee.getNameEn() : "Unknown";
        String empNameKh = employee != null && employee.getNameKh() != null ? employee.getNameKh() : "";
        String staffId = employee != null && employee.getStaffId() != null ? employee.getStaffId() : "N/A";
        
        String dept = "-";
        if (employee != null && employee.getDepartmentId() != null) {
            Optional<Department> dOpt = departmentRepository.findById(employee.getDepartmentId());
            if (dOpt.isPresent() && dOpt.get().getNameEn() != null) {
                dept = dOpt.get().getNameEn();
            }
        }

        String pos = "-";
        if (employee != null && employee.getPositionId() != null) {
            Optional<Position> pOpt = positionRepository.findById(employee.getPositionId());
            if (pOpt.isPresent() && pOpt.get().getTitleEn() != null) {
                pos = pOpt.get().getTitleEn();
            }
        }
        String branch = employee != null && employee.getBranch() != null ? employee.getBranch() : "-";

        String actionDisplay;
        String actionIcon;
        if ("checkin_1".equals(action)) {
            actionDisplay = "Check In 1 (Morning Shift)";
            actionIcon = "🟢";
        } else if ("checkout_1".equals(action)) {
            actionDisplay = "Check Out 1 (Lunch Break)";
            actionIcon = "🟡";
        } else if ("checkin_2".equals(action)) {
            actionDisplay = "Check In 2 (Afternoon Shift)";
            actionIcon = "🟢";
        } else if ("checkout_2".equals(action)) {
            actionDisplay = "Check Out 2 (End of Day)";
            actionIcon = "🔴";
        } else {
            actionDisplay = action != null ? action.toUpperCase() : "CHECK";
            actionIcon = "⏱️";
        }

        String dateStr = attendance != null && attendance.getAttendanceDate() != null
                ? attendance.getAttendanceDate().format(DateTimeFormatter.ofPattern("dd MMMM yyyy"))
                : java.time.LocalDate.now().format(DateTimeFormatter.ofPattern("dd MMMM yyyy"));

        String statusBadge = "✅ On Time";
        if (attendance != null && Boolean.TRUE.equals(attendance.getIsLate()) && isCheckinAction(action)) {
            statusBadge = "⚠️ <b>Late Arrival</b>";
        } else if (attendance != null && Boolean.TRUE.equals(attendance.getIsEarlyLeave()) && !isCheckinAction(action)) {
            statusBadge = "🚪 <b>Early Departure</b>";
        }

        StringBuilder sb = new StringBuilder();
        sb.append(actionIcon).append(" <b>ATTENDANCE NOTIFICATION</b>\n");
        sb.append("━━━━━━━━━━━━━━━━━━━━━━━\n");
        sb.append("👤 <b>Employee:</b> ").append(empNameEn);
        if (!empNameKh.isBlank()) {
            sb.append(" (").append(empNameKh).append(")");
        }
        sb.append("\n");
        sb.append("🆔 <b>Staff ID:</b> <code>").append(staffId).append("</code>\n");
        sb.append("🏢 <b>Department:</b> ").append(dept).append("\n");
        sb.append("💼 <b>Position:</b> ").append(pos).append("\n");
        sb.append("📅 <b>Date:</b> ").append(dateStr).append("\n");
        sb.append("⏰ <b>Action:</b> ").append(actionDisplay).append(" [<b>").append(timeString != null ? timeString : "-").append("</b>]\n");
        sb.append("📊 <b>Status:</b> ").append(statusBadge).append("\n");

        String locDisplay = (location != null && !location.isBlank()) ? location : branch;
        if (!locDisplay.isBlank() && !"-".equals(locDisplay)) {
            sb.append("📍 <b>Branch:</b> ").append(locDisplay).append("\n");
        }

        String finalNote = (note != null && !note.isBlank()) ? note : (attendance != null ? attendance.getNote() : null);
        if (finalNote != null && !finalNote.isBlank()) {
            sb.append("📝 <b>Note:</b> <i>").append(escapeHtml(finalNote)).append("</i>\n");
        }
        sb.append("━━━━━━━━━━━━━━━━━━━━━━━\n");

        return sb.toString();
    }

    private boolean isCheckinAction(String action) {
        return "checkin_1".equals(action) || "checkin_2".equals(action);
    }

    private String escapeHtml(String text) {
        if (text == null) return "";
        return text.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;");
    }

    private boolean sendTelegramMessageSync(String botToken, String chatId, String message) {
        if (botToken == null || botToken.isBlank() || chatId == null || chatId.isBlank()) {
            return false;
        }

        String cleanToken = botToken.trim();
        String cleanChatId = chatId.trim();

        // 1. Try sending with the exact provided chat ID
        if (executeTelegramSend(cleanToken, cleanChatId, message)) {
            return true;
        }

        // 2. Smart Fallback for Group IDs: If user provided a positive integer (e.g. 1369707188), try -100... and -...
        if (!cleanChatId.startsWith("-") && !cleanChatId.startsWith("@") && cleanChatId.matches("\\d+")) {
            String supergroupId = "-100" + cleanChatId;
            log.info("Attempting fallback with supergroup ID: {}", supergroupId);
            if (executeTelegramSend(cleanToken, supergroupId, message)) {
                return true;
            }

            String regularGroupId = "-" + cleanChatId;
            log.info("Attempting fallback with regular group ID: {}", regularGroupId);
            if (executeTelegramSend(cleanToken, regularGroupId, message)) {
                return true;
            }
        }

        return false;
    }

    private boolean executeTelegramSend(String botToken, String chatId, String message) {
        try {
            String url = String.format("https://api.telegram.org/bot%s/sendMessage", botToken);
            String body = "chat_id=" + URLEncoder.encode(chatId, StandardCharsets.UTF_8) +
                    "&text=" + URLEncoder.encode(message, StandardCharsets.UTF_8) +
                    "&parse_mode=HTML";

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("Content-Type", "application/x-www-form-urlencoded")
                    .timeout(Duration.ofSeconds(10))
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            log.info("Telegram API response for chatId {}: code={}, body={}", chatId, response.statusCode(), response.body());
            return response.statusCode() == 200;
        } catch (Exception e) {
            log.error("Telegram API execute error for chatId {}: {}", chatId, e.getMessage());
            return false;
        }
    }

    private void sendTelegramMessage(String botToken, String chatId, String message) {
        sendTelegramMessageSync(botToken, chatId, message);
    }
}
