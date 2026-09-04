package com.hrchomnan.backend.repository;

import com.hrchomnan.backend.model.Attendance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AttendanceRepository extends JpaRepository<Attendance, UUID> {
    List<Attendance> findByStaffId(String staffId);
    Optional<Attendance> findByStaffIdAndAttendanceDate(String staffId, LocalDate attendanceDate);
    List<Attendance> findByAttendanceDate(LocalDate attendanceDate);
    List<Attendance> findByAttendanceDateBetween(LocalDate startDate, LocalDate endDate);
    void deleteByStaffId(String staffId);
}
