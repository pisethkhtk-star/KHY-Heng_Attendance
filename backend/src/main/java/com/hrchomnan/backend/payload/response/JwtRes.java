package com.hrchomnan.backend.payload.response;

import com.hrchomnan.backend.constants.Constants;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class JwtRes {
    private String token; // For backward compatibility with mobile and frontend clients
    private String accessToken; // Standard springboot-jwt-api token property
    @Builder.Default
    private String tokenType = Constants.BEARER;
    private Long expiresIn;
    private Object user;
    private String role;
    private List<String> permissions;
    private String message;
    private String messageKh;
    private String code;
}
