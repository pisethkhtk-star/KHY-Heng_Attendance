package com.hrchomnan.backend.service;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.*;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

@Service
@Slf4j
public class FcmNotificationService {

    private boolean isFcmAvailable = false;

    @PostConstruct
    public void init() {
        try {
            if (!FirebaseApp.getApps().isEmpty()) {
                isFcmAvailable = true;
                log.info("[FCM] FirebaseApp already initialized");
                return;
            }

            InputStream serviceAccountStream = null;

            // 1. Check custom path from Environment Variable
            String customPath = System.getenv("FIREBASE_CONFIG_PATH");
            if (customPath != null && !customPath.isBlank()) {
                File file = new File(customPath.trim());
                if (file.exists()) {
                    serviceAccountStream = new FileInputStream(file);
                    log.info("[FCM] Loaded Firebase credentials from environment path: {}", customPath);
                }
            }

            // 2. Check classpath: firebase-service-account.json
            if (serviceAccountStream == null) {
                try {
                    ClassPathResource resource = new ClassPathResource("firebase-service-account.json");
                    if (resource.exists()) {
                        serviceAccountStream = resource.getInputStream();
                        log.info("[FCM] Loaded Firebase credentials from classpath (firebase-service-account.json)");
                    }
                } catch (Exception ignored) {}
            }

            // 3. Check current working directory: firebase-service-account.json
            if (serviceAccountStream == null) {
                File localFile = new File("firebase-service-account.json");
                if (localFile.exists()) {
                    serviceAccountStream = new FileInputStream(localFile);
                    log.info("[FCM] Loaded Firebase credentials from working directory file");
                }
            }

            if (serviceAccountStream == null) {
                log.warn("⚠️ [FCM Notice]: 'firebase-service-account.json' not found. " +
                        "Push notifications to phone status bar will be recorded in DB only. " +
                        "To enable real Google FCM pushes, place your Firebase service account JSON file in backend/src/main/resources/firebase-service-account.json");
                return;
            }

            FirebaseOptions options = FirebaseOptions.builder()
                    .setCredentials(GoogleCredentials.fromStream(serviceAccountStream))
                    .build();

            FirebaseApp.initializeApp(options);
            isFcmAvailable = true;
            log.info("✅ [FCM] Firebase Cloud Messaging Admin SDK successfully initialized!");
        } catch (Exception e) {
            log.error("❌ [FCM Error] Failed to initialize FirebaseApp: {}", e.getMessage());
            isFcmAvailable = false;
        }
    }

    /**
     * Send push notification to all employees subscribed to 'all_employees'
     */
    public void sendToAll(String title, String body, Map<String, String> data) {
        sendToTopic("all_employees", title, body, data);
    }

    /**
     * Send push notification to a specific department topic: 'dept_{cleanDeptId}'
     */
    public void sendToDepartment(UUID departmentId, String title, String body, Map<String, String> data) {
        if (departmentId == null) return;
        String cleanDept = departmentId.toString().replaceAll("[^a-zA-Z0-9_-]", "_");
        sendToTopic("dept_" + cleanDept, title, body, data);
    }

    /**
     * Send push notification to a specific staff member topic: 'staff_{cleanStaffId}'
     */
    public void sendToStaff(String staffId, String title, String body, Map<String, String> data) {
        if (staffId == null || staffId.isBlank()) return;
        String cleanStaff = staffId.trim().replaceAll("[^a-zA-Z0-9_-]", "_");
        sendToTopic("staff_" + cleanStaff, title, body, data);
    }

    /**
     * Core dispatcher: sends push notification to an FCM topic asynchronously
     */
    public void sendToTopic(String topic, String title, String body, Map<String, String> data) {
        if (!isFcmAvailable) {
            log.debug("[FCM Ignored] Firebase not initialized. Skipping push to topic: {}", topic);
            return;
        }

        CompletableFuture.runAsync(() -> {
            try {
                // Ensure data payload has non-null strings
                Map<String, String> safeData = new HashMap<>();
                if (data != null) {
                    data.forEach((k, v) -> {
                        if (k != null && v != null) {
                            safeData.put(k, v);
                        }
                    });
                }
                safeData.putIfAbsent("title", title != null ? title : "HR chomnan");
                safeData.putIfAbsent("body", body != null ? body : "");
                safeData.putIfAbsent("click_action", "FLUTTER_NOTIFICATION_CLICK");

                // 1. High-priority Android notification config
                AndroidConfig androidConfig = AndroidConfig.builder()
                        .setPriority(AndroidConfig.Priority.HIGH)
                        .setNotification(AndroidNotification.builder()
                                .setChannelId("attendance_push_channel")
                                .setTitle(title)
                                .setBody(body)
                                .setSound("default")
                                .setIcon("ic_launcher")
                                .setPriority(AndroidNotification.Priority.MAX)
                                .setVisibility(AndroidNotification.Visibility.PUBLIC)
                                .build())
                        .build();

                // 2. iOS APNs config
                ApnsConfig apnsConfig = ApnsConfig.builder()
                        .setAps(Aps.builder()
                                .setSound("default")
                                .setContentAvailable(true)
                                .build())
                        .build();

                // 3. Display notification payload (triggers native phone drawer even when app is killed)
                Notification notification = Notification.builder()
                        .setTitle(title)
                        .setBody(body)
                        .build();

                Message message = Message.builder()
                        .setTopic(topic)
                        .setNotification(notification)
                        .setAndroidConfig(androidConfig)
                        .setApnsConfig(apnsConfig)
                        .putAllData(safeData)
                        .build();

                String response = FirebaseMessaging.getInstance().send(message);
                log.info("🚀 [FCM Push Sent] Successfully dispatched to topic '{}' -> MessageId: {}", topic, response);
            } catch (Exception e) {
                log.error("❌ [FCM Push Failed] Error sending to topic '{}': {}", topic, e.getMessage());
            }
        });
    }
}
