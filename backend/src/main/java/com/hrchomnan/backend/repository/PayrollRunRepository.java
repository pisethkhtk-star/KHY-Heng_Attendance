package com.hrchomnan.backend.repository;

import com.hrchomnan.backend.model.PayrollRun;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PayrollRunRepository extends JpaRepository<PayrollRun, Long> {
    Optional<PayrollRun> findByMonthAndYear(Integer month, Integer year);
    List<PayrollRun> findAllByOrderByYearDescMonthDesc();
}
