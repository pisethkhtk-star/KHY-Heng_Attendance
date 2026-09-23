package com.hrchomnan.backend.payload.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class AttendanceLogReq {
    @NotBlank(message = "Action is required (CHECK_IN or CHECK_OUT)")
    private String action;

    private String staffId;
    private Double latitude;
    private Double longitude;
    private String note;
}
