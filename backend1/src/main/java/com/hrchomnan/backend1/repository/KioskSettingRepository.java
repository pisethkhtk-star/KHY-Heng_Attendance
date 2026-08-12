package com.hrchomnan.backend1.repository;

import com.hrchomnan.backend1.model.KioskSetting;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface KioskSettingRepository extends JpaRepository<KioskSetting, UUID> {
}
