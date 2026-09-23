package com.hrchomnan.backend.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

@ResponseStatus(HttpStatus.BAD_REQUEST)
public class AppException extends RuntimeException {
    private String messageKh;

    public AppException(String message) {
        super(message);
    }

    public AppException(String message, String messageKh) {
        super(message);
        this.messageKh = messageKh;
    }

    public AppException(String message, Throwable cause) {
        super(message, cause);
    }

    public String getMessageKh() {
        return messageKh;
    }
}
