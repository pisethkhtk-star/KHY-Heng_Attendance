package com.hrchomnan.backend1.repository;

import com.hrchomnan.backend1.model.EmployeeQRCode;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface EmployeeQRCodeRepository extends JpaRepository<EmployeeQRCode, UUID> {
    List<EmployeeQRCode> findByStaffId(String staffId);
    Optional<EmployeeQRCode> findByQrToken(String qrToken);
    void deleteByStaffId(String staffId);
}
