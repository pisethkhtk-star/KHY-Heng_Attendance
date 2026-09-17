package com.hrchomnan.backend.service;

import com.hrchomnan.backend.enums.Role;
import com.hrchomnan.backend.model.Employee;
import com.hrchomnan.backend.model.Leave;
import com.hrchomnan.backend.model.LeaveApprovalRule;
import com.hrchomnan.backend.model.Notification;
import com.hrchomnan.backend.repository.EmployeeRepository;
import com.hrchomnan.backend.repository.LeaveApprovalRuleRepository;
import com.hrchomnan.backend.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final EmployeeRepository employeeRepository;
    private final LeaveApprovalRuleRepository leaveApprovalRuleRepository;

    /**
     * Notify approver(s) when an employee submits a leave request
     */
    @Transactional
    public void notifyApproversOnLeaveRequest(Leave leave, Employee employee, String durationType, Double totalDays) {
        if (leave == null || employee == null) return;

        try {
            Set<String> approverStaffIds = findApproversForEmployee(employee);

            String empName = (employee.getNameKh() != null && !employee.getNameKh().isBlank())
                    ? employee.getNameKh() + " (" + employee.getNameEn() + ")"
                    : employee.getNameEn();

            String periodStr = leave.getLeaveDate() != null ? leave.getLeaveDate().toString() : "-";
            String daysText = totalDays != null ? " (" + totalDays + " ថ្ងៃ)" : "";
            String durText = durationType != null && !"Full Day".equalsIgnoreCase(durationType) ? " [" + durationType + "]" : "";

            String title = "ពាក្យស្នើសុំច្បាប់ថ្មី (New Leave Request)";
            String message = empName + " បានស្នើសុំច្បាប់ " + leave.getLeaveType() + daysText + durText +
                    " សម្រាប់ថ្ងៃ " + periodStr +
                    (leave.getReason() != null && !leave.getReason().isBlank() ? " | មូលហេតុ: " + leave.getReason() : "");

            for (String approverId : approverStaffIds) {
                if (approverId.equalsIgnoreCase(employee.getStaffId())) continue;

                Notification notification = Notification.builder()
                        .recipientStaffId(approverId)
                        .senderStaffId(employee.getStaffId())
                        .senderName(empName)
                        .title(title)
                        .message(message)
                        .type("LEAVE_REQUEST")
                        .targetId(leave.getId() != null ? leave.getId().toString() : null)
                        .isRead(false)
                        .createdAt(LocalDateTime.now())
                        .build();

                notificationRepository.save(notification);
                log.info("Saved leave request notification for approver: {}", approverId);
            }
        } catch (Exception e) {
            log.error("Error creating leave request notifications for approvers:", e);
        }
    }

    /**
     * Notify employee when approver updates leave status (Approved / Rejected)
     */
    @Transactional
    public void notifyEmployeeOnLeaveAction(Leave leave, Employee employee, String newStatus, String managerName, String reason) {
        if (leave == null || employee == null) return;

        try {
            boolean isApproved = "Approved".equalsIgnoreCase(newStatus);
            String title = isApproved
                    ? "ពាក្យស្នើសុំច្បាប់ត្រូវបានអនុម័ត 🎉"
                    : "ពាក្យស្នើសុំច្បាប់ត្រូវបានបដិសេធ ⚠️";

            String actionText = isApproved ? "អនុម័ត (Approved)" : "បដិសេធ (Rejected)";
            String approverText = managerName != null && !managerName.isBlank() ? managerName : "ថ្នាក់ដឹកនាំ";

            String message = "ពាក្យស្នើសុំច្បាប់ " + leave.getLeaveType() + " (កាលបរិច្ឆេទ: " +
                    (leave.getLeaveDate() != null ? leave.getLeaveDate().toString() : "-") +
                    ") ត្រូវបាន " + actionText + " ដោយ " + approverText + "។" +
                    (reason != null && !reason.isBlank() ? " [កំណត់សម្គាល់: " + reason + "]" : "");

            Notification notification = Notification.builder()
                    .recipientStaffId(leave.getStaffId())
                    .senderStaffId(null)
                    .senderName(approverText)
                    .title(title)
                    .message(message)
                    .type(isApproved ? "LEAVE_APPROVED" : "LEAVE_REJECTED")
                    .targetId(leave.getId() != null ? leave.getId().toString() : null)
                    .isRead(false)
                    .createdAt(LocalDateTime.now())
                    .build();

            notificationRepository.save(notification);
            log.info("Saved leave action notification for employee: {}", leave.getStaffId());
        } catch (Exception e) {
            log.error("Error creating leave action notification for employee:", e);
        }
    }

    /**
     * Notify relevant party when a leave request is deleted/cancelled
     */
    @Transactional
    public void notifyOnLeaveDeletion(Leave leave, Employee employee, Employee actionBy) {
        if (leave == null || employee == null) return;

        try {
            boolean isSelfDelete = actionBy != null && actionBy.getStaffId().equalsIgnoreCase(leave.getStaffId());

            if (!isSelfDelete) {
                // Approver/Admin deleted employee's leave -> notify the employee
                String actorName = actionBy != null ? actionBy.getNameEn() : "Admin / Manager";
                String title = "ពាក្យស្នើសុំច្បាប់ត្រូវបានលុបចោល 🗑️";
                String message = "ពាក្យស្នើសុំច្បាប់ " + leave.getLeaveType() + " (កាលបរិច្ឆេទ: " +
                        (leave.getLeaveDate() != null ? leave.getLeaveDate().toString() : "-") +
                        ") ត្រូវបានលុបចេញដោយ " + actorName + "។";

                Notification notification = Notification.builder()
                        .recipientStaffId(leave.getStaffId())
                        .senderStaffId(actionBy != null ? actionBy.getStaffId() : null)
                        .senderName(actorName)
                        .title(title)
                        .message(message)
                        .type("LEAVE_DELETED")
                        .targetId(leave.getId() != null ? leave.getId().toString() : null)
                        .isRead(false)
                        .createdAt(LocalDateTime.now())
                        .build();

                notificationRepository.save(notification);
                log.info("Saved leave deletion notification for employee: {}", leave.getStaffId());
            } else {
                // Employee deleted own pending leave -> notify designated approvers
                Set<String> approverStaffIds = findApproversForEmployee(employee);
                String empName = (employee.getNameKh() != null && !employee.getNameKh().isBlank())
                        ? employee.getNameKh() + " (" + employee.getNameEn() + ")"
                        : employee.getNameEn();

                String title = "បុគ្គលិកបានលុបចោលពាក្យស្នើសុំច្បាប់";
                String message = empName + " បានលុបចោលពាក្យស្នើសុំច្បាប់ " + leave.getLeaveType() +
                        " (កាលបរិច្ឆេទ: " + (leave.getLeaveDate() != null ? leave.getLeaveDate().toString() : "-") + ")។";

                for (String approverId : approverStaffIds) {
                    if (approverId.equalsIgnoreCase(employee.getStaffId())) continue;

                    Notification notification = Notification.builder()
                            .recipientStaffId(approverId)
                            .senderStaffId(employee.getStaffId())
                            .senderName(empName)
                            .title(title)
                            .message(message)
                            .type("LEAVE_CANCELLED")
                            .targetId(leave.getId() != null ? leave.getId().toString() : null)
                            .isRead(false)
                            .createdAt(LocalDateTime.now())
                            .build();

                    notificationRepository.save(notification);
                }
                log.info("Saved leave cancellation notifications for approvers of staff: {}", employee.getStaffId());
            }
        } catch (Exception e) {
            log.error("Error creating leave delete notification:", e);
        }
    }

    /**
     * Helper to resolve approvers for a given employee
     */
    public Set<String> findApproversForEmployee(Employee employee) {
        Set<String> approvers = new HashSet<>();

        // 1. Individual rule
        List<LeaveApprovalRule> indRules = leaveApprovalRuleRepository.findByTargetStaffId(employee.getStaffId()).stream()
                .filter(r -> "Employee".equalsIgnoreCase(r.getScope()) && ("LEAVE".equalsIgnoreCase(r.getRuleType()) || r.getRuleType() == null))
                .toList();
        indRules.forEach(r -> {
            if (r.getApproverId() != null && !r.getApproverId().isBlank()) {
                approvers.add(r.getApproverId().trim());
            }
        });

        // 2. Department rule
        if (employee.getDepartmentId() != null) {
            List<LeaveApprovalRule> deptRules = leaveApprovalRuleRepository.findByTargetDeptId(employee.getDepartmentId()).stream()
                    .filter(r -> "Department".equalsIgnoreCase(r.getScope()) && ("LEAVE".equalsIgnoreCase(r.getRuleType()) || r.getRuleType() == null))
                    .toList();
            deptRules.forEach(r -> {
                if (r.getApproverId() != null && !r.getApproverId().isBlank()) {
                    approvers.add(r.getApproverId().trim());
                }
            });
        }

        // 3. Fallback: If no specific rule, fallback to all active Admins, Managers, HR
        if (approvers.isEmpty()) {
            List<Employee> fallbackUsers = employeeRepository.findAll().stream()
                    .filter(e -> e.getRole() == Role.Admin || e.getRole() == Role.Manager || e.getRole() == Role.HR)
                    .toList();
            fallbackUsers.forEach(e -> approvers.add(e.getStaffId()));
        }

        return approvers;
    }
}
