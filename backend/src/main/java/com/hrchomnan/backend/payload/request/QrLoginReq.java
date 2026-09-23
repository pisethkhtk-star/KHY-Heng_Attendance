package com.hrchomnan.backend.payload.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class QrLoginReq {
    @NotBlank(message = "QR Token is required")
    private String qrToken;
}
