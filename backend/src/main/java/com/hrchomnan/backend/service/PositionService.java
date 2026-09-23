package com.hrchomnan.backend.service;

import com.hrchomnan.backend.model.Position;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public interface PositionService {
    List<Map<String, Object>> getAllPositions();
    Map<String, Object> getPositionById(UUID id);
    Position createPosition(Position position);
    Position updatePosition(UUID id, Position updated);
    void deletePosition(UUID id);
}
