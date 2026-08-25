package com.hrchomnan.backend.controller;

import com.hrchomnan.backend.model.KioskSetting;
import com.hrchomnan.backend.repository.KioskSettingRepository;
import com.hrchomnan.backend.util.QrCodeHelper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/kiosk-settings")
@RequiredArgsConstructor
@Slf4j
public class KioskSettingsController {

    private final KioskSettingRepository kioskSettingRepository;
    private final QrCodeHelper qrCodeHelper;

    @GetMapping
    public ResponseEntity<List<KioskSetting>> getAllSettings() {
        return ResponseEntity.ok(kioskSettingRepository.findAll());
    }

    @PostMapping
    public ResponseEntity<?> createSetting(@RequestBody KioskSetting setting) {
        if (setting.getName() == null || setting.getLatitude() == null || setting.getLongitude() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Name, latitude, and longitude are required"));
        }

        KioskSetting newSetting = KioskSetting.builder()
                .name(setting.getName().trim())
                .latitude(setting.getLatitude())
                .longitude(setting.getLongitude())
                .radius(setting.getRadius() != null ? setting.getRadius() : 100.0)
                .build();

        KioskSetting saved = kioskSettingRepository.save(newSetting);
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "message", "Kiosk geofencing settings saved",
                "data", saved
        ));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateSetting(@PathVariable UUID id, @RequestBody KioskSetting setting) {
        Optional<KioskSetting> existingOpt = kioskSettingRepository.findById(id);
        if (existingOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Kiosk setting not found"));
        }

        KioskSetting existing = existingOpt.get();
        if (setting.getName() != null && !setting.getName().isBlank()) {
            existing.setName(setting.getName().trim());
        }
        if (setting.getLatitude() != null) {
            existing.setLatitude(setting.getLatitude());
        }
        if (setting.getLongitude() != null) {
            existing.setLongitude(setting.getLongitude());
        }
        if (setting.getRadius() != null) {
            existing.setRadius(setting.getRadius());
        }

        KioskSetting saved = kioskSettingRepository.save(existing);
        return ResponseEntity.ok(Map.of(
                "message", "Kiosk geofencing settings updated",
                "data", saved
        ));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteSetting(@PathVariable UUID id) {
        if (kioskSettingRepository.existsById(id)) {
            kioskSettingRepository.deleteById(id);
            return ResponseEntity.ok(Map.of("message", "Kiosk geofence deleted successfully"));
        }
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Kiosk setting not found"));
    }

    @GetMapping("/{id}/qrcode")
    public ResponseEntity<?> getBranchQrCode(@PathVariable UUID id) {
        Optional<KioskSetting> branchOpt = kioskSettingRepository.findById(id);
        if (branchOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Branch location not found"));
        }

        try {
            String token = "branch_qr:" + id;
            String qrImage = qrCodeHelper.generateQrCodeBase64(token, 300, 300);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "qrToken", token,
                    "qrImage", qrImage
            ));
        } catch (Exception e) {
            log.error("Error generating branch QR code for id: {}", id, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("message", "Server error generating branch QR code"));
        }
    }
}
