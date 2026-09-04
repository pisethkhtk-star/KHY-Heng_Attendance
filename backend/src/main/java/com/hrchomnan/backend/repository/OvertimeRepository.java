package com.hrchomnan.backend.repository;

import com.hrchomnan.backend.enums.LeaveStatus;
import com.hrchomnan.backend.model.Overtime;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public interface OvertimeRepository extends JpaRepository<Overtime, UUID> {

    List<Overtime> findByStaffId(String staffId);

    List<Overtime> findByStatus(LeaveStatus status);

    List<Overtime> findByStaffIdOrderByRequestedAtDesc(String staffId);

    List<Overtime> findByOrderByRequestedAtDesc();

    @Query("SELECT o FROM Overtime o WHERE " +
            "(:staffId IS NULL OR o.staffId = :staffId) AND " +
            "(:status IS NULL OR o.status = :status) AND " +
            "(:branch IS NULL OR LOWER(o.branch) LIKE LOWER(CONCAT('%', :branch, '%'))) AND " +
            "(:startDate IS NULL OR o.fromDate >= :startDate) AND " +
            "(:endDate IS NULL OR o.toDate <= :endDate) " +
            "ORDER BY o.requestedAt DESC")
    List<Overtime> findWithFilters(
            @Param("staffId") String staffId,
            @Param("status") LeaveStatus status,
            @Param("branch") String branch,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate
    );

    void deleteByStaffId(String staffId);

    @Modifying
    @Query("UPDATE Overtime o SET o.managerId = null, o.managerName = null WHERE o.managerId = :managerId")
    void clearManagerReferences(@Param("managerId") String managerId);
}
