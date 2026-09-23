package com.hrchomnan.backend.controller;

import com.hrchomnan.backend.constants.Constants;
import com.hrchomnan.backend.model.Employee;
import com.hrchomnan.backend.payload.request.LoginReq;
import com.hrchomnan.backend.payload.request.QrLoginReq;
import com.hrchomnan.backend.payload.response.JwtRes;
import com.hrchomnan.backend.payload.response.MessageRes;
import com.hrchomnan.backend.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Authentication", description = "Login, QR authentication, profile and credentials management")
public class AuthController {

    private final AuthService authService;

    @Operation(summary = "User Login", description = "Authenticate using email and password to receive JWT token")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Login successful"),
            @ApiResponse(responseCode = "400", description = "Invalid request payload"),
            @ApiResponse(responseCode = "401", description = "Invalid email or password"),
            @ApiResponse(responseCode = "403", description = "Account disabled or unauthorized client")
    })
    @SecurityRequirements
    @PostMapping("/login")
    public ResponseEntity<JwtRes> login(@Valid @RequestBody LoginReq request) {
        log.info("Processing login request for: {}", request.getEmail());
        JwtRes response = authService.login(request);
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "QR Code Login", description = "Authenticate using dynamic or physical QR code token")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "QR login successful"),
            @ApiResponse(responseCode = "401", description = "Invalid or expired QR token")
    })
    @SecurityRequirements
    @PostMapping("/login-qr")
    public ResponseEntity<JwtRes> loginWithQRCode(@Valid @RequestBody QrLoginReq request) {
        log.info("Processing QR login request");
        JwtRes response = authService.loginWithQr(request);
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Current User Profile", description = "Fetch current logged in employee details")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Profile retrieved successfully"),
            @ApiResponse(responseCode = "401", description = "Unauthorized")
    })
    @GetMapping("/me")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Object>> getMe(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof Employee employee)) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(authService.getMe(employee));
    }

    @Data
    public static class UpdateAvatarRequest {
        private String avatar;
    }

    @Operation(summary = "Update Avatar", description = "Update photo URL of the current user")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Avatar updated successfully"),
            @ApiResponse(responseCode = "401", description = "Unauthorized")
    })
    @PutMapping("/avatar")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<MessageRes> updateAvatar(Authentication authentication, @RequestBody UpdateAvatarRequest request) {
        if (authentication == null || !(authentication.getPrincipal() instanceof Employee employee)) {
            return ResponseEntity.status(401).build();
        }
        Map<String, Object> userData = authService.updateAvatar(employee, request != null ? request.getAvatar() : null);
        
        MessageRes res = new MessageRes();
        res.setCode(Constants.CODE_SUCCESS);
        res.setMessage("Avatar updated successfully");
        res.setMessageKh("រូបភាពត្រូវបានកែប្រែដោយជោគជ័យ");
        res.setData(Map.of("success", true, "user", userData));
        return ResponseEntity.ok(res);
    }
}
