package com.hrchomnan.backend.repository;

import com.hrchomnan.backend.model.TelegramSetting;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface TelegramSettingRepository extends JpaRepository<TelegramSetting, UUID> {
}
