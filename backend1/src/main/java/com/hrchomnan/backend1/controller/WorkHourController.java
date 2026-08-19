package com.hrchomnan.backend1.controller;

import com.hrchomnan.backend1.model.CompanyWorkHour;
import com.hrchomnan.backend1.repository.CompanyWorkHourRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/company-work-hours")
@RequiredArgsConstructor
public class WorkHourController {

    private final CompanyWorkHourRepository workHourRepository;

    @GetMapping
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
    public ResponseEntity<?> saveCompanyWorkHours(@RequestBody CompanyWorkHour request) {
        return upsertWorkHour(request);
    }

    @PutMapping
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
                    .build();
        } else {
            workHour = list.get(0);
            workHour.setShift1Start(request.getShift1Start());
            workHour.setShift1End(request.getShift1End());
            workHour.setShift2Start(request.getShift2Start());
            workHour.setShift2End(request.getShift2End());
        }

        CompanyWorkHour saved = workHourRepository.save(workHour);
        return ResponseEntity.ok(Map.of(
                "message", "Company default work hours updated successfully",
                "data", saved
        ));
    }
}
