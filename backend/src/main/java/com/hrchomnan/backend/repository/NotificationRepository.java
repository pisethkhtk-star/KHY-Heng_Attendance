package com.hrchomnan.backend.repository;

import com.hrchomnan.backend.model.Notification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, UUID> {

    List<Notification> findByRecipientStaffIdOrderByCreatedAtDesc(String recipientStaffId);

    long countByRecipientStaffIdAndIsReadFalse(String recipientStaffId);

    void deleteByRecipientStaffId(String recipientStaffId);
}
