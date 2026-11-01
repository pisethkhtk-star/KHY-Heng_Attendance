package com.hrchomnan.backend.service;

import com.hrchomnan.backend.model.Position;

import java.util.List;
import java.util.Map;

public interface PositionService {
    List<Map<String, Object>> getAllPositions();
    Map<String, Object> getPositionById(Long id);
    Position createPosition(Position position);
    Position updatePosition(Long id, Position updated);
    void deletePosition(Long id);
}
