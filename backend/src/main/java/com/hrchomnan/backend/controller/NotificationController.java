package com.hrchomnan.backend.controller;

import com.hrchomnan.backend.model.Employee;
import com.hrchomnan.backend.model.Notification;
import com.hrchomnan.backend.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/notifications")
@Transactional
@RequiredArgsConstructor
@Slf4j
public class NotificationController {

    private final NotificationRepository notificationRepository;

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<Notification>> getMyNotifications(Authentication authentication) {
        Employee currentUser = getCurrentUser(authentication);
        if (currentUser == null || currentUser.getStaffId() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        List<Notification> list = notificationRepository.findByRecipientStaffIdOrderByCreatedAtDesc(currentUser.getStaffId());
        return ResponseEntity.ok(list);
    }

    @GetMapping("/unread-count")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Object>> getUnreadCount(Authentication authentication) {
        Employee currentUser = getCurrentUser(authentication);
        if (currentUser == null || currentUser.getStaffId() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        long count = notificationRepository.countByRecipientStaffIdAndIsReadFalse(currentUser.getStaffId());
        return ResponseEntity.ok(Map.of("unreadCount", count));
    }

    @PutMapping("/{id}/read")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> markAsRead(@PathVariable UUID id, Authentication authentication) {
        Employee currentUser = getCurrentUser(authentication);
        if (currentUser == null || currentUser.getStaffId() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        Optional<Notification> opt = notificationRepository.findById(id);
        if (opt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Notification not found"));
        }

        Notification notification = opt.get();
        if (!notification.getRecipientStaffId().equalsIgnoreCase(currentUser.getStaffId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Access denied"));
        }

        notification.setIsRead(true);
        notificationRepository.save(notification);
        return ResponseEntity.ok(notification);
    }

    @PutMapping("/read-all")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> markAllAsRead(Authentication authentication) {
        Employee currentUser = getCurrentUser(authentication);
        if (currentUser == null || currentUser.getStaffId() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        List<Notification> list = notificationRepository.findByRecipientStaffIdOrderByCreatedAtDesc(currentUser.getStaffId());
        for (Notification n : list) {
            if (Boolean.FALSE.equals(n.getIsRead())) {
                n.setIsRead(true);
                notificationRepository.save(n);
            }
        }

        return ResponseEntity.ok(Map.of("success", true, "message", "All notifications marked as read"));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> deleteNotification(@PathVariable UUID id, Authentication authentication) {
        Employee currentUser = getCurrentUser(authentication);
        if (currentUser == null || currentUser.getStaffId() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        Optional<Notification> opt = notificationRepository.findById(id);
        if (opt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Notification not found"));
        }

        Notification notification = opt.get();
        if (!notification.getRecipientStaffId().equalsIgnoreCase(currentUser.getStaffId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Access denied"));
        }

        notificationRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("success", true, "message", "Notification deleted"));
    }

    @DeleteMapping("/clear-all")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> clearAll(Authentication authentication) {
        Employee currentUser = getCurrentUser(authentication);
        if (currentUser == null || currentUser.getStaffId() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        notificationRepository.deleteByRecipientStaffId(currentUser.getStaffId());
        return ResponseEntity.ok(Map.of("success", true, "message", "All notifications cleared"));
    }

    private Employee getCurrentUser(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof Employee emp) {
            return emp;
        }
        return null;
    }
}
