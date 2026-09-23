package com.hrchomnan.backend.service;

import com.hrchomnan.backend.model.Department;
import com.hrchomnan.backend.model.Employee;
import com.hrchomnan.backend.model.Notification;
import com.hrchomnan.backend.model.PushNotificationCampaign;
import com.hrchomnan.backend.model.TelegramSetting;
import com.hrchomnan.backend.repository.DepartmentRepository;
import com.hrchomnan.backend.repository.EmployeeRepository;
import com.hrchomnan.backend.repository.NotificationRepository;
import com.hrchomnan.backend.repository.PushNotificationCampaignRepository;
import com.hrchomnan.backend.repository.TelegramSettingRepository;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class PushNotificationCampaignService {

    private final PushNotificationCampaignRepository campaignRepository;
    private final NotificationRepository notificationRepository;
    private final EmployeeRepository employeeRepository;
    private final DepartmentRepository departmentRepository;
    private final TelegramSettingRepository telegramSettingRepository;
    private final FcmNotificationService fcmNotificationService;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    @Data
    public static class CreateCampaignRequest {
        private String title;
        private String message;
        private String type = "ANNOUNCEMENT"; // ANNOUNCEMENT, URGENT, EVENT, REMINDER, GENERAL
        private String targetAudience = "ALL"; // ALL, DEPARTMENT, INDIVIDUAL
        private UUID targetDepartmentId;
        private List<String> targetStaffIds;
        private String scheduledAt; // ISO string e.g. "2026-09-17T16:00:00"
        private Boolean sendTelegram = false;
    }

    public List<PushNotificationCampaign> getAllCampaigns() {
        return campaignRepository.findAllByOrderByCreatedAtDesc();
    }

    public Map<String, Object> getCampaignStats() {
        long total = campaignRepository.count();
        long pending = campaignRepository.countByStatus("PENDING");
        long sent = campaignRepository.countByStatus("SENT");
        long cancelled = campaignRepository.countByStatus("CANCELLED");
        return Map.of(
                "total", total,
                "pending", pending,
                "sent", sent,
                "cancelled", cancelled
        );
    }

    @Transactional
    public PushNotificationCampaign createCampaign(CreateCampaignRequest request, Employee currentUser) {
        if (request.getTitle() == null || request.getTitle().isBlank()) {
            throw new IllegalArgumentException("Notification title is required");
        }
        if (request.getMessage() == null || request.getMessage().isBlank()) {
            throw new IllegalArgumentException("Notification message is required");
        }

        String creatorName = currentUser != null ? currentUser.getNameEn() : "System Admin";
        String creatorStaffId = currentUser != null ? currentUser.getStaffId() : "SYSTEM";

        LocalDateTime scheduledDateTime = null;
        if (request.getScheduledAt() != null && !request.getScheduledAt().isBlank()) {
            try {
                scheduledDateTime = LocalDateTime.parse(request.getScheduledAt().trim());
            } catch (Exception e) {
                log.warn("Failed to parse scheduledAt: {}", request.getScheduledAt());
            }
        }

        // Resolve target department name if applicable
        String deptName = null;
        if (request.getTargetDepartmentId() != null) {
            Optional<Department> dOpt = departmentRepository.findById(request.getTargetDepartmentId());
            if (dOpt.isPresent()) {
                deptName = dOpt.get().getNameKh() != null ? dOpt.get().getNameKh() + " (" + dOpt.get().getNameEn() + ")" : dOpt.get().getNameEn();
            }
        }

        String staffIdsJoined = null;
        if (request.getTargetStaffIds() != null && !request.getTargetStaffIds().isEmpty()) {
            staffIdsJoined = String.join(",", request.getTargetStaffIds());
        }

        List<Employee> targetEmployees = resolveTargetEmployees(
                request.getTargetAudience(),
                request.getTargetDepartmentId(),
                request.getTargetStaffIds()
        );

        boolean isImmediate = (scheduledDateTime == null || scheduledDateTime.isBefore(LocalDateTime.now().plusSeconds(10)));

        PushNotificationCampaign campaign = PushNotificationCampaign.builder()
                .title(request.getTitle().trim())
                .message(request.getMessage().trim())
                .type(request.getType() != null ? request.getType().toUpperCase() : "ANNOUNCEMENT")
                .targetAudience(request.getTargetAudience() != null ? request.getTargetAudience().toUpperCase() : "ALL")
                .targetDepartmentId(request.getTargetDepartmentId())
                .targetDepartmentName(deptName)
                .targetStaffIds(staffIdsJoined)
                .scheduledAt(scheduledDateTime)
                .status(isImmediate ? "SENT" : "PENDING")
                .recipientCount(targetEmployees.size())
                .createdBy(creatorName)
                .sendTelegram(Boolean.TRUE.equals(request.getSendTelegram()))
                .sentAt(isImmediate ? LocalDateTime.now() : null)
                .build();

        PushNotificationCampaign saved = campaignRepository.save(campaign);

        if (isImmediate) {
            dispatchToRecipients(saved, targetEmployees, creatorStaffId, creatorName);
        }

        return saved;
    }

    @Transactional
    public PushNotificationCampaign cancelCampaign(UUID id) {
        PushNotificationCampaign campaign = campaignRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Campaign not found"));

        if (!"PENDING".equalsIgnoreCase(campaign.getStatus())) {
            throw new IllegalStateException("Only pending scheduled campaigns can be cancelled");
        }

        campaign.setStatus("CANCELLED");
        return campaignRepository.save(campaign);
    }

    @Transactional
    public void deleteCampaign(UUID id) {
        campaignRepository.deleteById(id);
    }

    /**
     * Periodic background cron: runs every 15 seconds to check and dispatch scheduled notifications
     */
    @Scheduled(fixedDelay = 15000)
    @Transactional
    public void processScheduledCampaigns() {
        LocalDateTime now = LocalDateTime.now();
        List<PushNotificationCampaign> dueCampaigns = campaignRepository.findDuePendingCampaigns(now);

        if (dueCampaigns.isEmpty()) return;

        log.info("Found {} due scheduled push notification campaigns to dispatch", dueCampaigns.size());

        for (PushNotificationCampaign campaign : dueCampaigns) {
            try {
                List<String> staffIdList = (campaign.getTargetStaffIds() != null && !campaign.getTargetStaffIds().isBlank())
                        ? Arrays.asList(campaign.getTargetStaffIds().split(","))
                        : null;

                List<Employee> targetEmployees = resolveTargetEmployees(
                        campaign.getTargetAudience(),
                        campaign.getTargetDepartmentId(),
                        staffIdList
                );

                dispatchToRecipients(campaign, targetEmployees, "SYSTEM", campaign.getCreatedBy());

                campaign.setStatus("SENT");
                campaign.setSentAt(LocalDateTime.now());
                campaign.setRecipientCount(targetEmployees.size());
                campaignRepository.save(campaign);

                log.info("Successfully dispatched scheduled campaign '{}' to {} recipients",
                        campaign.getTitle(), targetEmployees.size());
            } catch (Exception e) {
                log.error("Error dispatching scheduled campaign {}: ", campaign.getId(), e);
            }
        }
    }

    private void dispatchToRecipients(
            PushNotificationCampaign campaign,
            List<Employee> targetEmployees,
            String senderStaffId,
            String senderName
    ) {
        List<Notification> notifications = new ArrayList<>();
        LocalDateTime now = LocalDateTime.now();

        for (Employee emp : targetEmployees) {
            Notification n = Notification.builder()
                    .recipientStaffId(emp.getStaffId())
                    .senderStaffId(senderStaffId)
                    .senderName(senderName)
                    .title(campaign.getTitle())
                    .message(campaign.getMessage())
                    .type(campaign.getType()) // ANNOUNCEMENT, URGENT, EVENT, REMINDER, GENERAL
                    .targetId(campaign.getId() != null ? campaign.getId().toString() : null)
                    .isRead(false)
                    .createdAt(now)
                    .build();
            notifications.add(n);
        }

        if (!notifications.isEmpty()) {
            notificationRepository.saveAll(notifications);
        }

        // Cross-post to Telegram if enabled
        if (Boolean.TRUE.equals(campaign.getSendTelegram())) {
            sendTelegramBroadcast(campaign);
        }

        // Dispatch real FCM Push to phone status bars (even if app is closed/killed)
        dispatchFcmPush(campaign, targetEmployees);
    }

    private void dispatchFcmPush(PushNotificationCampaign campaign, List<Employee> targetEmployees) {
        if (fcmNotificationService == null) return;

        Map<String, String> data = new HashMap<>();
        data.put("type", campaign.getType() != null ? campaign.getType() : "ANNOUNCEMENT");
        data.put("targetId", campaign.getId() != null ? campaign.getId().toString() : "");
        data.put("title", campaign.getTitle());
        data.put("message", campaign.getMessage());

        String targetAudience = campaign.getTargetAudience() != null ? campaign.getTargetAudience().toUpperCase() : "ALL";

        if ("ALL".equals(targetAudience)) {
            fcmNotificationService.sendToAll(campaign.getTitle(), campaign.getMessage(), data);
        } else if ("DEPARTMENT".equals(targetAudience) && campaign.getTargetDepartmentId() != null) {
            fcmNotificationService.sendToDepartment(campaign.getTargetDepartmentId(), campaign.getTitle(), campaign.getMessage(), data);
        } else {
            // INDIVIDUAL or targeted list: send to each staff's dedicated topic
            for (Employee emp : targetEmployees) {
                if (emp.getStaffId() != null && !emp.getStaffId().isBlank()) {
                    fcmNotificationService.sendToStaff(emp.getStaffId(), campaign.getTitle(), campaign.getMessage(), data);
                }
            }
        }
    }

    private List<Employee> resolveTargetEmployees(
            String targetAudience,
            UUID targetDepartmentId,
            List<String> targetStaffIds
    ) {
        List<Employee> all = employeeRepository.findAll();

        if ("DEPARTMENT".equalsIgnoreCase(targetAudience) && targetDepartmentId != null) {
            return all.stream()
                    .filter(e -> targetDepartmentId.equals(e.getDepartmentId()))
                    .collect(Collectors.toList());
        }

        if ("INDIVIDUAL".equalsIgnoreCase(targetAudience) && targetStaffIds != null && !targetStaffIds.isEmpty()) {
            Set<String> set = targetStaffIds.stream().map(String::trim).map(String::toLowerCase).collect(Collectors.toSet());
            return all.stream()
                    .filter(e -> e.getStaffId() != null && set.contains(e.getStaffId().toLowerCase()))
                    .collect(Collectors.toList());
        }

        // Default: ALL employees
        return all;
    }

    private void sendTelegramBroadcast(PushNotificationCampaign campaign) {
        CompletableFuture.runAsync(() -> {
            try {
                List<TelegramSetting> settingsList = telegramSettingRepository.findAll();
                if (settingsList.isEmpty()) return;

                TelegramSetting setting = settingsList.get(0);
                if (setting.getIsEnabled() == null || !setting.getIsEnabled()) return;
                if (setting.getBotToken() == null || setting.getBotToken().isBlank()) return;
                if (setting.getChatId() == null || setting.getChatId().isBlank()) return;

                String typeBadge;
                String typeIcon;
                switch (campaign.getType()) {
                    case "URGENT" -> {
                        typeBadge = "🔴 <b>URGENT ALERT (បន្ទាន់)</b>";
                        typeIcon = "🚨";
                    }
                    case "EVENT" -> {
                        typeBadge = "🟣 <b>EVENT NOTICE (ព្រឹត្តិការណ៍)</b>";
                        typeIcon = "🎉";
                    }
                    case "REMINDER" -> {
                        typeBadge = "🟡 <b>REMINDER (ការរំលឹក)</b>";
                        typeIcon = "⏰";
                    }
                    default -> {
                        typeBadge = "📢 <b>COMPANY ANNOUNCEMENT (សេចក្តីជូនដំណឹង)</b>";
                        typeIcon = "📣";
                    }
                }

                String timeStr = LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd-MM-yyyy HH:mm"));

                StringBuilder sb = new StringBuilder();
                sb.append(typeIcon).append(" ").append(typeBadge).append("\n");
                sb.append("━━━━━━━━━━━━━━━━━━━━━━━\n");
                sb.append("📌 <b>ចំណងជើង / Title:</b> ").append(campaign.getTitle()).append("\n");
                sb.append("👥 <b>គោលដៅ / Target:</b> ").append(campaign.getTargetAudience());
                if (campaign.getTargetDepartmentName() != null) {
                    sb.append(" [").append(campaign.getTargetDepartmentName()).append("]");
                }
                sb.append("\n");
                sb.append("📅 <b>កាលបរិច្ឆេទ / Date:</b> ").append(timeStr).append("\n");
                sb.append("━━━━━━━━━━━━━━━━━━━━━━━\n");
                sb.append("💬 <b>សេចក្តីលម្អិត / Message:</b>\n");
                sb.append(campaign.getMessage()).append("\n");
                sb.append("━━━━━━━━━━━━━━━━━━━━━━━\n");
                sb.append("👨‍💼 <i>ផ្ញើដោយ / Sent by: ").append(campaign.getCreatedBy() != null ? campaign.getCreatedBy() : "HR Admin").append("</i>\n");

                String message = sb.toString();
                String url = String.format("https://api.telegram.org/bot%s/sendMessage", setting.getBotToken());
                String body = "chat_id=" + URLEncoder.encode(setting.getChatId(), StandardCharsets.UTF_8) +
                        "&text=" + URLEncoder.encode(message, StandardCharsets.UTF_8) +
                        "&parse_mode=HTML";

                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create(url))
                        .header("Content-Type", "application/x-www-form-urlencoded")
                        .timeout(Duration.ofSeconds(10))
                        .POST(HttpRequest.BodyPublishers.ofString(body))
                        .build();

                httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            } catch (Exception e) {
                log.error("Failed to send Telegram campaign broadcast:", e);
            }
        });
    }
}
