package com.hrchomnan.backend.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "telegram_settings")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TelegramSetting {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "bot_token", length = 500)
    private String botToken;

    @Column(name = "chat_id", length = 100)
    private String chatId;

    @Column(name = "is_enabled")
    @Builder.Default
    private Boolean isEnabled = true;

    @Column(name = "send_on_checkin")
    @Builder.Default
    private Boolean sendOnCheckin = true;

    @Column(name = "send_on_checkout")
    @Builder.Default
    private Boolean sendOnCheckout = true;

    @Column(name = "send_only_late")
    @Builder.Default
    private Boolean sendOnlyLate = false;

    // Separate Leave Notifications Channel
    @Column(name = "leave_bot_token", length = 500)
    private String leaveBotToken;

    @Column(name = "leave_chat_id", length = 100)
    private String leaveChatId;

    @Column(name = "leave_enabled")
    @Builder.Default
    private Boolean leaveEnabled = true;

    @Column(name = "send_on_leave_request")
    @Builder.Default
    private Boolean sendOnLeaveRequest = true;

    @Column(name = "send_on_leave_approval")
    @Builder.Default
    private Boolean sendOnLeaveApproval = true;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
