package com.impactmapper.exception;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler(RepositoryResourceLimitExceededException.class)
    public ResponseEntity<Map<String, Object>> handleResourceLimitExceeded(RepositoryResourceLimitExceededException ex) {
        log.warn("Repository resource limit exceeded: limit={}, actual={}, max={}, unit={}. Message: {}",
                ex.getLimitType(), ex.getActualValue(), ex.getLimitValue(), ex.getUnit(), ex.getMessage());
        Map<String, Object> error = new java.util.LinkedHashMap<>();
        error.put("error", "RESOURCE_LIMIT_EXCEEDED");
        error.put("limitType", ex.getLimitType());
        error.put("actualValue", ex.getActualValue());
        error.put("limitValue", ex.getLimitValue());
        error.put("unit", ex.getUnit());
        error.put("message", ex.getMessage());
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY).body(error);
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, Object>> handleIllegalStateException(IllegalStateException ex) {
        String msg = ex.getMessage() != null ? ex.getMessage() : "Invalid application state";
        Map<String, Object> error = new java.util.LinkedHashMap<>();
        if (msg.contains("in progress") || msg.contains("capacity") || msg.contains("concurrent")) {
            log.warn("Request rejected due to concurrency limit: {}", msg);
            error.put("error", "CONCURRENCY_LIMIT_REACHED");
            error.put("message", msg);
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(error);
        }
        error.put("error", msg);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleIllegalArgumentException(IllegalArgumentException ex) {
        Map<String, String> error = new HashMap<>();
        error.put("error", ex.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
    }

    @ExceptionHandler(org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class)
    public ResponseEntity<Map<String, String>> handleMethodArgumentTypeMismatchException(org.springframework.web.method.annotation.MethodArgumentTypeMismatchException ex) {
        Map<String, String> error = new HashMap<>();
        error.put("error", "Invalid parameter '" + ex.getName() + "': " + ex.getValue());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
    }

    @ExceptionHandler(GitHubApiException.class)
    public ResponseEntity<Map<String, String>> handleGitHubApiException(GitHubApiException ex) {
        Map<String, String> error = new HashMap<>();
        error.put("error", "GitHub API Error: " + ex.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(error);
    }

    @ExceptionHandler(RepoNotFoundException.class)
    public ResponseEntity<Map<String, String>> handleRepoNotFoundException(RepoNotFoundException ex) {
        Map<String, String> error = new HashMap<>();
        error.put("error", ex.getMessage());
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
    }

    @ExceptionHandler(InvalidVersionFormatException.class)
    public ResponseEntity<Map<String, String>> handleInvalidVersionFormatException(InvalidVersionFormatException ex) {
        Map<String, String> error = new HashMap<>();
        error.put("error", ex.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
    }

    @ExceptionHandler(org.springframework.web.servlet.resource.NoResourceFoundException.class)
    public ResponseEntity<Map<String, String>> handleNoResourceFoundException(org.springframework.web.servlet.resource.NoResourceFoundException ex) {
        Map<String, String> error = new HashMap<>();
        error.put("error", ex.getMessage());
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handleGeneralException(Exception ex) {
        log.error("Unhandled server exception: ", ex);
        Map<String, String> error = new HashMap<>();
        error.put("error", "Server Error: " + (ex.getMessage() != null ? ex.getMessage() : "Unexpected error occurred"));
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
    }
}
