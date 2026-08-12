package com.hrchomnan.backend1.controller;

import com.hrchomnan.backend1.model.LeaveApprovalRule;
import com.hrchomnan.backend1.repository.LeaveApprovalRuleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/leave-approvals")
@RequiredArgsConstructor
public class LeaveApprovalController {

    private final LeaveApprovalRuleRepository ruleRepository;

    @GetMapping
    public ResponseEntity<List<LeaveApprovalRule>> getAllRules(@RequestParam(required = false) String approverId) {
        if (approverId != null) {
            return ResponseEntity.ok(ruleRepository.findByApproverId(approverId));
        }
        return ResponseEntity.ok(ruleRepository.findAll());
    }

    @PostMapping
    public ResponseEntity<LeaveApprovalRule> createRule(@RequestBody LeaveApprovalRule rule) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ruleRepository.save(rule));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteRule(@PathVariable UUID id) {
        if (ruleRepository.existsById(id)) {
            ruleRepository.deleteById(id);
            return ResponseEntity.ok(Map.of("message", "Rule deleted successfully"));
        }
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Rule not found"));
    }
}
