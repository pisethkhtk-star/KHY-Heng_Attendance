package com.hrchomnan.backend.service;

import com.hrchomnan.backend.model.Employee;
import com.hrchomnan.backend.payload.request.LoginReq;
import com.hrchomnan.backend.payload.request.QrLoginReq;
import com.hrchomnan.backend.payload.response.JwtRes;

import java.util.Map;

public interface AuthService {
    JwtRes login(LoginReq request);
    JwtRes loginWithQr(QrLoginReq request);
    Map<String, Object> getMe(Employee employee);
    Map<String, Object> updateAvatar(Employee employee, String avatarUrl);
    Map<String, Object> buildEmployeeResponse(Employee employee);
}
