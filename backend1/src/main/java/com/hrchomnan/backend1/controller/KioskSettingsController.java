package com.hrchomnan.backend1.controller;

import com.hrchomnan.backend1.model.KioskSetting;
import com.hrchomnan.backend1.repository.KioskSettingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/kiosk-settings")
@RequiredArgsConstructor
public class KioskSettingsController {

    private final KioskSettingRepository kioskSettingRepository;

    @GetMapping
    public ResponseEntity<List<KioskSetting>> getAllSettings() {
        return ResponseEntity.ok(kioskSettingRepository.findAll());
    }

    @PostMapping
    public ResponseEntity<KioskSetting> createSetting(@RequestBody KioskSetting setting) {
        KioskSetting saved = kioskSettingRepository.save(setting);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateSetting(@PathVariable UUID id, @RequestBody KioskSetting updated) {
        Optional<KioskSetting> existingOpt = kioskSettingRepository.findById(id);
        if (existingOpt.isPresent()) {
            KioskSetting existing = existingOpt.get();
            if (updated.getName() != null) existing.setName(updated.getName());
            if (updated.getLatitude() != null) existing.setLatitude(updated.getLatitude());
            if (updated.getLongitude() != null) existing.setLongitude(updated.getLongitude());
            if (updated.getRadius() != null) existing.setRadius(updated.getRadius());
            return ResponseEntity.ok(kioskSettingRepository.save(existing));
        }
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Setting not found"));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteSetting(@PathVariable UUID id) {
        if (kioskSettingRepository.existsById(id)) {
            kioskSettingRepository.deleteById(id);
            return ResponseEntity.ok(Map.of("message", "Setting deleted successfully"));
        }
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Setting not found"));
    }
}
