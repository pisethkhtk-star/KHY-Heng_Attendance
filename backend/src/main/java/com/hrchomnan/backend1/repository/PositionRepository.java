package com.hrchomnan.backend1.repository;

import com.hrchomnan.backend1.model.Position;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface PositionRepository extends JpaRepository<Position, UUID> {
    List<Position> findByDepartmentId(UUID departmentId);
}
