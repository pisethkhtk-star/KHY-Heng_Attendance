package com.hrchomnan.backend.controller;

import com.hrchomnan.backend.model.Employee;
import com.hrchomnan.backend.model.PushNotificationCampaign;
import com.hrchomnan.backend.service.PushNotificationCampaignService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/push-campaigns")
@RequiredArgsConstructor
@Slf4j
public class PushNotificationCampaignController {

    private final PushNotificationCampaignService campaignService;

    @GetMapping
    @PreAuthorize("hasAnyRole('Admin', 'HR', 'Manager') or @perm.has('push_notifications')")
    public ResponseEntity<List<PushNotificationCampaign>> getAllCampaigns() {
        return ResponseEntity.ok(campaignService.getAllCampaigns());
    }

    @GetMapping("/stats")
    @PreAuthorize("hasAnyRole('Admin', 'HR', 'Manager') or @perm.has('push_notifications')")
    public ResponseEntity<Map<String, Object>> getStats() {
        return ResponseEntity.ok(campaignService.getCampaignStats());
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('Admin', 'HR', 'Manager') or @perm.has('push_notifications')")
    public ResponseEntity<?> createCampaign(
            @RequestBody PushNotificationCampaignService.CreateCampaignRequest request,
            Authentication authentication
    ) {
        Employee currentUser = getCurrentUser(authentication);
        try {
            PushNotificationCampaign campaign = campaignService.createCampaign(request, currentUser);
            return ResponseEntity.status(HttpStatus.CREATED).body(campaign);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        } catch (Exception e) {
            log.error("Error creating push notification campaign:", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Failed to create campaign: " + e.getMessage()));
        }
    }

    @PutMapping("/{id}/cancel")
    @PreAuthorize("hasAnyRole('Admin', 'HR', 'Manager') or @perm.has('push_notifications')")
    public ResponseEntity<?> cancelCampaign(@PathVariable UUID id) {
        try {
            PushNotificationCampaign campaign = campaignService.cancelCampaign(id);
            return ResponseEntity.ok(campaign);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", e.getMessage()));
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('Admin', 'HR', 'Manager') or @perm.has('push_notifications')")
    public ResponseEntity<?> deleteCampaign(@PathVariable UUID id) {
        try {
            campaignService.deleteCampaign(id);
            return ResponseEntity.ok(Map.of("success", true, "message", "Campaign deleted successfully"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Failed to delete campaign: " + e.getMessage()));
        }
    }

    private Employee getCurrentUser(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof Employee emp) {
            return emp;
        }
        return null;
    }
}
