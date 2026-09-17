package com.hrchomnan.backend.repository;

import com.hrchomnan.backend.model.PushNotificationCampaign;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface PushNotificationCampaignRepository extends JpaRepository<PushNotificationCampaign, UUID> {

    List<PushNotificationCampaign> findAllByOrderByCreatedAtDesc();

    @Query("SELECT c FROM PushNotificationCampaign c WHERE c.status = 'PENDING' AND (c.scheduledAt IS NULL OR c.scheduledAt <= :now)")
    List<PushNotificationCampaign> findDuePendingCampaigns(@Param("now") LocalDateTime now);

    long countByStatus(String status);
}
