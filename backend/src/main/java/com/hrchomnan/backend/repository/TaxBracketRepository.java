package com.hrchomnan.backend.repository;

import com.hrchomnan.backend.model.TaxBracket;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface TaxBracketRepository extends JpaRepository<TaxBracket, UUID> {
    List<TaxBracket> findAllByOrderByTierAsc();
}
