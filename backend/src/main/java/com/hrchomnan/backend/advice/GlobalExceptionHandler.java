package com.hrchomnan.backend.advice;

import com.hrchomnan.backend.constants.Constants;
import com.hrchomnan.backend.exception.AppException;
import com.hrchomnan.backend.exception.BadRequestException;
import com.hrchomnan.backend.exception.ResourceNotFoundException;
import com.hrchomnan.backend.payload.response.MessageRes;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<MessageRes> handleResourceNotFoundException(ResourceNotFoundException ex) {
        log.warn("Resource not found: {}", ex.getMessage());
        MessageRes res = new MessageRes();
        res.setCode(Constants.CODE_NOT_FOUND);
        res.setMessage(ex.getMessage());
        res.setMessageKh(Constants.MSG_NOT_FOUND_KH);
        return new ResponseEntity<>(res, HttpStatus.NOT_FOUND);
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<MessageRes> handleBadCredentialsException(BadCredentialsException ex) {
        log.warn("Bad credentials: {}", ex.getMessage());
        MessageRes res = new MessageRes();
        res.setCode(Constants.CODE_UNAUTHORIZED);
        res.setMessage(ex.getMessage());
        res.setMessageKh(Constants.MSG_UNAUTHORIZED_KH);
        return new ResponseEntity<>(res, HttpStatus.UNAUTHORIZED);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<MessageRes> handleAccessDeniedException(AccessDeniedException ex) {
        log.warn("Access denied: {}", ex.getMessage());
        MessageRes res = new MessageRes();
        res.setCode(Constants.CODE_FORBIDDEN);
        res.setMessage("You do not have permission to access this resource");
        res.setMessageKh("លោកអ្នកមិនមានសិទ្ធិចូលប្រើប្រាស់មុខងារនេះទេ");
        return new ResponseEntity<>(res, HttpStatus.FORBIDDEN);
    }

    @ExceptionHandler(AppException.class)
    public ResponseEntity<MessageRes> handleAppException(AppException ex) {
        log.error("Application error: {}", ex.getMessage());
        MessageRes res = new MessageRes();
        res.setCode(Constants.CODE_BAD_REQUEST);
        res.setMessage(ex.getMessage());
        res.setMessageKh(ex.getMessageKh() != null ? ex.getMessageKh() : Constants.MSG_BAD_REQUEST_KH);
        return new ResponseEntity<>(res, HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(BadRequestException.class)
    public ResponseEntity<MessageRes> handleBadRequestException(BadRequestException ex) {
        log.warn("Bad request: {}", ex.getMessage());
        MessageRes res = new MessageRes();
        res.setCode(Constants.CODE_BAD_REQUEST);
        res.setMessage(ex.getMessage());
        res.setMessageKh(Constants.MSG_BAD_REQUEST_KH);
        return new ResponseEntity<>(res, HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<MessageRes> handleValidationExceptions(MethodArgumentNotValidException ex) {
        Map<String, String> errors = new HashMap<>();
        ex.getBindingResult().getAllErrors().forEach((error) -> {
            String fieldName = ((FieldError) error).getField();
            String errorMessage = error.getDefaultMessage();
            errors.put(fieldName, errorMessage);
        });
        MessageRes res = new MessageRes();
        res.setCode(Constants.CODE_BAD_REQUEST);
        res.setMessage("Validation error");
        res.setMessageKh("ទិន្នន័យបញ្ចូលមិនត្រឹមត្រូវ");
        res.setData(errors);
        return new ResponseEntity<>(res, HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<MessageRes> handleGlobalException(Exception ex) {
        log.error("Internal server error: ", ex);
        MessageRes res = new MessageRes();
        res.setCode(Constants.CODE_SERVER_ERROR);
        res.setMessage(ex.getMessage() != null ? ex.getMessage() : Constants.MSG_SERVER_ERROR);
        res.setMessageKh(Constants.MSG_SERVER_ERROR_KH);
        return new ResponseEntity<>(res, HttpStatus.INTERNAL_SERVER_ERROR);
    }
}
