package com.hrchomnan.backend.repository;

import com.hrchomnan.backend.model.CompanyWorkHour;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;


@Repository
public interface CompanyWorkHourRepository extends JpaRepository<CompanyWorkHour, Long> {
}
