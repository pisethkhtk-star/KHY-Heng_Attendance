package com.hrchomnan.backend.repository;

import com.hrchomnan.backend.model.TaxBracket;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TaxBracketRepository extends JpaRepository<TaxBracket, Long> {
    List<TaxBracket> findAllByOrderByTierAsc();
}
