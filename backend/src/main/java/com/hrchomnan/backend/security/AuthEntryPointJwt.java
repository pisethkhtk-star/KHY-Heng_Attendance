package com.hrchomnan.backend.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hrchomnan.backend.constants.Constants;
import com.hrchomnan.backend.payload.response.MessageRes;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
@Slf4j
public class AuthEntryPointJwt implements AuthenticationEntryPoint {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response, AuthenticationException authException)
            throws IOException, ServletException {
        log.error("Unauthorized error: {}", authException.getMessage());

        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);

        MessageRes messageRes = new MessageRes();
        messageRes.setCode(Constants.CODE_UNAUTHORIZED);
        messageRes.setMessage("Unauthorized: " + authException.getMessage());
        messageRes.setMessageKh(Constants.MSG_UNAUTHORIZED_KH);

        objectMapper.writeValue(response.getOutputStream(), messageRes);
    }
}
