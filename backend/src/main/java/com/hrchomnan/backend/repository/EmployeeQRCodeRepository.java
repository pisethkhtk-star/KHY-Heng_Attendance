package com.hrchomnan.backend.repository;

import com.hrchomnan.backend.model.EmployeeQRCode;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EmployeeQRCodeRepository extends JpaRepository<EmployeeQRCode, Long> {
    List<EmployeeQRCode> findByStaffId(String staffId);
    Optional<EmployeeQRCode> findByQrToken(String qrToken);
    void deleteByStaffId(String staffId);
}
