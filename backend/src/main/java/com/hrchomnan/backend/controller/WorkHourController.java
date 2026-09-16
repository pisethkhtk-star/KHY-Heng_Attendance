package com.hrchomnan.backend.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hrchomnan.backend.model.CompanyWorkHour;
import com.hrchomnan.backend.repository.CompanyWorkHourRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/company-work-hours")
@Transactional
@RequiredArgsConstructor
public class WorkHourController {

    private final CompanyWorkHourRepository workHourRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @GetMapping("/exempt-days")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getExemptDays() {
        List<CompanyWorkHour> list = workHourRepository.findAll();
        if (list.isEmpty()) {
            return ResponseEntity.ok(List.of());
        }
        CompanyWorkHour wh = list.get(0);
        return ResponseEntity.ok(extractExemptDays(wh.getFlexibleSchedule()));
    }

    @PostMapping("/exempt-days")
    @PreAuthorize("@perm.has('attendance_incomplete') or @perm.has('work_hours') or hasAnyRole('Admin', 'HR', 'Manager')")
    public ResponseEntity<?> addOrUpdateExemptDay(@RequestBody Map<String, Object> body) {
        List<CompanyWorkHour> list = workHourRepository.findAll();
        CompanyWorkHour wh;
        if (list.isEmpty()) {
            wh = workHourRepository.save(CompanyWorkHour.builder()
                    .shift1Start("08:00")
                    .shift1End("12:00")
                    .shift2Start("13:00")
                    .shift2End("17:00")
                    .flexibleSchedule("{}")
                    .build());
        } else {
            wh = list.get(0);
        }

        try {
            Map<String, Object> schedMap = parseSchedule(wh.getFlexibleSchedule());
            List<Map<String, Object>> exemptList = getExemptList(schedMap);

            String id = (String) body.get("id");
            if (id == null || id.isBlank()) {
                id = UUID.randomUUID().toString();
                body.put("id", id);
            }
            if (!body.containsKey("createdAt")) {
                body.put("createdAt", java.time.LocalDateTime.now().toString());
            }

            final String finalId = id;
            boolean found = false;
            for (int i = 0; i < exemptList.size(); i++) {
                if (finalId.equals(exemptList.get(i).get("id"))) {
                    exemptList.set(i, body);
                    found = true;
                    break;
                }
            }
            if (!found) {
                exemptList.add(body);
            }

            schedMap.put("exemptDays", exemptList);
            wh.setFlexibleSchedule(objectMapper.writeValueAsString(schedMap));
            workHourRepository.save(wh);

            return ResponseEntity.ok(Map.of(
                    "message", "Exempt date saved successfully",
                    "exemptDays", exemptList
            ));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("message", "Error saving exempt date: " + e.getMessage()));
        }
    }

    @DeleteMapping("/exempt-days/{id}")
    @PreAuthorize("@perm.has('attendance_incomplete') or @perm.has('work_hours') or hasAnyRole('Admin', 'HR', 'Manager')")
    public ResponseEntity<?> deleteExemptDay(@PathVariable String id) {
        List<CompanyWorkHour> list = workHourRepository.findAll();
        if (list.isEmpty()) {
            return ResponseEntity.ok(Map.of("message", "Exempt date deleted", "exemptDays", List.of()));
        }
        CompanyWorkHour wh = list.get(0);

        try {
            Map<String, Object> schedMap = parseSchedule(wh.getFlexibleSchedule());
            List<Map<String, Object>> exemptList = getExemptList(schedMap);

            exemptList.removeIf(item -> id.equals(item.get("id")));
            schedMap.put("exemptDays", exemptList);
            wh.setFlexibleSchedule(objectMapper.writeValueAsString(schedMap));
            workHourRepository.save(wh);

            return ResponseEntity.ok(Map.of(
                    "message", "Exempt date deleted successfully",
                    "exemptDays", exemptList
            ));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("message", "Error deleting exempt date: " + e.getMessage()));
        }
    }

    private Map<String, Object> parseSchedule(String flexJson) {
        if (flexJson == null || flexJson.isBlank()) return new HashMap<>();
        try {
            return objectMapper.readValue(flexJson, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            return new HashMap<>();
        }
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> getExemptList(Map<String, Object> schedMap) {
        Object existing = schedMap.get("exemptDays");
        if (existing instanceof List<?> l) {
            List<Map<String, Object>> res = new ArrayList<>();
            for (Object obj : l) {
                if (obj instanceof Map<?, ?> m) {
                    res.add(new HashMap<>((Map<String, Object>) m));
                }
            }
            return res;
        }
        return new ArrayList<>();
    }

    private List<Map<String, Object>> extractExemptDays(String flexJson) {
        return getExemptList(parseSchedule(flexJson));
    }

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<CompanyWorkHour> getCompanyWorkHours() {
        List<CompanyWorkHour> list = workHourRepository.findAll();
        if (list.isEmpty()) {
            CompanyWorkHour defaultHour = CompanyWorkHour.builder()
                    .shift1Start("08:00")
                    .shift1End("12:00")
                    .shift2Start("13:00")
                    .shift2End("17:00")
                    .build();
            return ResponseEntity.ok(workHourRepository.save(defaultHour));
        }
        return ResponseEntity.ok(list.get(0));
    }

    @PostMapping
    @PreAuthorize("@perm.has('work_hours') or hasRole('Admin')")
    public ResponseEntity<?> saveCompanyWorkHours(@RequestBody CompanyWorkHour request) {
        return upsertWorkHour(request);
    }

    @PutMapping
    @PreAuthorize("@perm.has('work_hours') or hasRole('Admin')")
    public ResponseEntity<?> updateCompanyWorkHours(@RequestBody CompanyWorkHour request) {
        return upsertWorkHour(request);
    }

    private ResponseEntity<?> upsertWorkHour(CompanyWorkHour request) {
        if (request.getShift1Start() == null || request.getShift1End() == null ||
                request.getShift2Start() == null || request.getShift2End() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "All shift start and end times are required"));
        }

        List<CompanyWorkHour> list = workHourRepository.findAll();
        CompanyWorkHour workHour;
        if (list.isEmpty()) {
            workHour = CompanyWorkHour.builder()
                    .shift1Start(request.getShift1Start())
                    .shift1End(request.getShift1End())
                    .shift2Start(request.getShift2Start())
                    .shift2End(request.getShift2End())
                    .isFlexible(request.getIsFlexible() != null ? request.getIsFlexible() : false)
                    .lateGraceMinutes(request.getLateGraceMinutes() != null ? request.getLateGraceMinutes() : 0)
                    .flexibleSchedule(request.getFlexibleSchedule() != null ? request.getFlexibleSchedule() : "{}")
                    .build();
        } else {
            workHour = list.get(0);
            workHour.setShift1Start(request.getShift1Start());
            workHour.setShift1End(request.getShift1End());
            workHour.setShift2Start(request.getShift2Start());
            workHour.setShift2End(request.getShift2End());
            if (request.getIsFlexible() != null) {
                workHour.setIsFlexible(request.getIsFlexible());
            }
            if (request.getLateGraceMinutes() != null) {
                workHour.setLateGraceMinutes(request.getLateGraceMinutes());
            }
            if (request.getFlexibleSchedule() != null) {
                workHour.setFlexibleSchedule(request.getFlexibleSchedule());
            }
        }

        CompanyWorkHour saved = workHourRepository.save(workHour);
        return ResponseEntity.ok(Map.of(
                "message", "Company default work hours updated successfully",
                "data", saved
        ));
    }
}
