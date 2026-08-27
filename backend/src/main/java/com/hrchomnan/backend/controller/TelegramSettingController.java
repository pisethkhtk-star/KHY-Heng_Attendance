package com.hrchomnan.backend.controller;

import com.hrchomnan.backend.model.TelegramSetting;
import com.hrchomnan.backend.repository.TelegramSettingRepository;
import com.hrchomnan.backend.service.TelegramNotificationService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/telegram-settings")
@RequiredArgsConstructor
public class TelegramSettingController {

    private final TelegramSettingRepository telegramSettingRepository;
    private final TelegramNotificationService telegramNotificationService;

    @GetMapping
    public ResponseEntity<?> getSettings() {
        try {
            List<TelegramSetting> list = telegramSettingRepository.findAll();
            if (list.isEmpty()) {
                TelegramSetting defaultSetting = TelegramSetting.builder()
                        .botToken("")
                        .chatId("")
                        .isEnabled(false)
                        .sendOnCheckin(true)
                        .sendOnCheckout(true)
                        .sendOnlyLate(false)
                        .build();
                return ResponseEntity.ok(telegramSettingRepository.save(defaultSetting));
            }
            return ResponseEntity.ok(list.get(0));
        } catch (Exception e) {
            return ResponseEntity.ok(TelegramSetting.builder()
                    .botToken("")
                    .chatId("")
                    .isEnabled(false)
                    .sendOnCheckin(true)
                    .sendOnCheckout(true)
                    .sendOnlyLate(false)
                    .build());
        }
    }

    @PostMapping
    public ResponseEntity<?> saveSettings(@RequestBody TelegramSetting request) {
        try {
            List<TelegramSetting> list = telegramSettingRepository.findAll();
            TelegramSetting setting;
            if (list.isEmpty()) {
                setting = TelegramSetting.builder()
                        .botToken(request.getBotToken() != null ? request.getBotToken().trim() : "")
                        .chatId(request.getChatId() != null ? request.getChatId().trim() : "")
                        .isEnabled(request.getIsEnabled() != null ? request.getIsEnabled() : false)
                        .sendOnCheckin(request.getSendOnCheckin() != null ? request.getSendOnCheckin() : true)
                        .sendOnCheckout(request.getSendOnCheckout() != null ? request.getSendOnCheckout() : true)
                        .sendOnlyLate(request.getSendOnlyLate() != null ? request.getSendOnlyLate() : false)
                        .leaveBotToken(request.getLeaveBotToken() != null ? request.getLeaveBotToken().trim() : "")
                        .leaveChatId(request.getLeaveChatId() != null ? request.getLeaveChatId().trim() : "")
                        .leaveEnabled(request.getLeaveEnabled() != null ? request.getLeaveEnabled() : true)
                        .sendOnLeaveRequest(request.getSendOnLeaveRequest() != null ? request.getSendOnLeaveRequest() : true)
                        .sendOnLeaveApproval(request.getSendOnLeaveApproval() != null ? request.getSendOnLeaveApproval() : true)
                        .build();
            } else {
                setting = list.get(0);
                if (request.getBotToken() != null) setting.setBotToken(request.getBotToken().trim());
                if (request.getChatId() != null) setting.setChatId(request.getChatId().trim());
                if (request.getIsEnabled() != null) setting.setIsEnabled(request.getIsEnabled());
                if (request.getSendOnCheckin() != null) setting.setSendOnCheckin(request.getSendOnCheckin());
                if (request.getSendOnCheckout() != null) setting.setSendOnCheckout(request.getSendOnCheckout());
                if (request.getSendOnlyLate() != null) setting.setSendOnlyLate(request.getSendOnlyLate());

                if (request.getLeaveBotToken() != null) setting.setLeaveBotToken(request.getLeaveBotToken().trim());
                if (request.getLeaveChatId() != null) setting.setLeaveChatId(request.getLeaveChatId().trim());
                if (request.getLeaveEnabled() != null) setting.setLeaveEnabled(request.getLeaveEnabled());
                if (request.getSendOnLeaveRequest() != null) setting.setSendOnLeaveRequest(request.getSendOnLeaveRequest());
                if (request.getSendOnLeaveApproval() != null) setting.setSendOnLeaveApproval(request.getSendOnLeaveApproval());
            }

            TelegramSetting saved = telegramSettingRepository.save(setting);
            return ResponseEntity.ok(Map.of(
                    "message", "Telegram settings updated successfully",
                    "data", saved
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", "Error saving settings: " + e.getMessage()));
        }
    }

    @Data
    public static class TestMessageRequest {
        private String botToken;
        private String chatId;
    }

    @PostMapping("/test")
    public ResponseEntity<?> sendTest(@RequestBody(required = false) TestMessageRequest request) {
        String token = request != null ? request.getBotToken() : null;
        String chat = request != null ? request.getChatId() : null;

        if (token == null || token.isBlank() || chat == null || chat.isBlank()) {
            List<TelegramSetting> list = telegramSettingRepository.findAll();
            if (!list.isEmpty()) {
                token = list.get(0).getBotToken();
                chat = list.get(0).getChatId();
            }
        }

        if (token == null || token.isBlank() || chat == null || chat.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Bot Token and Chat ID are required"));
        }

        boolean success = telegramNotificationService.sendTestMessage(token, chat);
        if (success) {
            return ResponseEntity.ok(Map.of("message", "Test notification sent successfully to Attendance Telegram Group!"));
        } else {
            return ResponseEntity.badRequest().body(Map.of("message", "Failed to send Telegram message. Please verify your Bot Token and Chat ID."));
        }
    }

    @PostMapping("/test-leave")
    public ResponseEntity<?> sendTestLeave(@RequestBody(required = false) TestMessageRequest request) {
        String token = request != null ? request.getBotToken() : null;
        String chat = request != null ? request.getChatId() : null;

        if (token == null || token.isBlank() || chat == null || chat.isBlank()) {
            List<TelegramSetting> list = telegramSettingRepository.findAll();
            if (!list.isEmpty()) {
                token = (list.get(0).getLeaveBotToken() != null && !list.get(0).getLeaveBotToken().isBlank())
                        ? list.get(0).getLeaveBotToken()
                        : list.get(0).getBotToken();
                chat = list.get(0).getLeaveChatId();
            }
        }

        if (token == null || token.isBlank() || chat == null || chat.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Leave Bot Token and Leave Chat ID are required"));
        }

        boolean success = telegramNotificationService.sendTestLeaveMessage(token, chat);
        if (success) {
            return ResponseEntity.ok(Map.of("message", "Test notification sent successfully to Leave Requests Telegram Group!"));
        } else {
            return ResponseEntity.badRequest().body(Map.of("message", "Failed to send Leave Telegram message. Please verify Leave Bot Token and Chat ID."));
        }
    }
}
