package com.hrchomnan.backend.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@RestController
public class RootController {

    @GetMapping({"/", ""})
    public ResponseEntity<Map<String, Object>> getRoot() {
        Map<String, Object> response = new HashMap<>();
        response.put("status", "UP");
        response.put("service", "HR Chomnan Spring Boot Backend API");
        response.put("message", "API Server is running successfully");
        response.put("timestamp", LocalDateTime.now().toString());
        response.put("version", "1.0.0");
        return ResponseEntity.ok(response);
    }
}
