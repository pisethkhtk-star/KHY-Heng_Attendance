package com.hrchomnan.backend.controller;

import com.hrchomnan.backend.model.Position;
import com.hrchomnan.backend.service.PositionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/positions")
@RequiredArgsConstructor
@Tag(name = "Positions", description = "Job positions, titles and department associations")
public class PositionController {

    private final PositionService positionService;

    @Operation(summary = "Get all positions", description = "Retrieve list of all positions with department and employee counts")
    @ApiResponse(responseCode = "200", description = "Positions list")
    @GetMapping
    @PreAuthorize("@perm.has('positions')")
    public ResponseEntity<List<Map<String, Object>>> getAllPositions() {
        return ResponseEntity.ok(positionService.getAllPositions());
    }

    @Operation(summary = "Get position by ID", description = "Retrieve position details and employee counts")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Position found"),
            @ApiResponse(responseCode = "404", description = "Position not found")
    })
    @GetMapping("/{id}")
    @PreAuthorize("@perm.has('positions')")
    public ResponseEntity<Map<String, Object>> getPositionById(@PathVariable UUID id) {
        return ResponseEntity.ok(positionService.getPositionById(id));
    }

    @Operation(summary = "Create position", description = "Add a new job position")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Position created"),
            @ApiResponse(responseCode = "400", description = "Missing required fields")
    })
    @PostMapping
    @PreAuthorize("@perm.has('add_position')")
    public ResponseEntity<Position> createPosition(@RequestBody Position position) {
        Position saved = positionService.createPosition(position);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @Operation(summary = "Update position", description = "Update details of existing position")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Position updated"),
            @ApiResponse(responseCode = "404", description = "Position not found")
    })
    @PutMapping("/{id}")
    @PreAuthorize("@perm.has('edit_position')")
    public ResponseEntity<Position> updatePosition(@PathVariable UUID id, @RequestBody Position updated) {
        return ResponseEntity.ok(positionService.updatePosition(id, updated));
    }

    @Operation(summary = "Delete position", description = "Delete job position and detach employees")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Position deleted"),
            @ApiResponse(responseCode = "404", description = "Position not found")
    })
    @DeleteMapping("/{id}")
    @PreAuthorize("@perm.has('delete_position')")
    public ResponseEntity<Void> deletePosition(@PathVariable UUID id) {
        positionService.deletePosition(id);
        return ResponseEntity.noContent().build();
    }
}
