package com.thirtylab.common;


import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.util.List;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<Result<Void>> handleBusiness(BusinessException ex){
        ErrorCode ec = ex.getErrorCode();
        log.warn("業務錯誤 {}: {}", ec.getCode(), ex.getMessage());
        return ResponseEntity.status(ec.getStatus())
                .body(Result.fail(ec.getCode(), ex.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Result<List<FieldViolation>>> handleValidation(MethodArgumentNotValidException ex) {
        List<FieldViolation> violations = ex.getBindingResult().getFieldErrors().stream()
                .map(e -> new FieldViolation(e.getField(), toRule(e.getCode())))
                .toList();
        log.warn("參數驗證失敗: {}", violations);
        ErrorCode ec = ErrorCode.VALIDATION_FAILED;
        return ResponseEntity.status(ec.getStatus())
                .body(Result.fail(ec.getCode(), ec.getMessage(), violations));
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<Result<List<FieldViolation>>> handleTypeMismatch(MethodArgumentTypeMismatchException ex){
        List<FieldViolation> violations = List.of(new FieldViolation(ex.getName(),"typeMismatch"));
        log.warn("參數型別錯誤: {}", violations);
        ErrorCode ec = ErrorCode.VALIDATION_FAILED;
        return ResponseEntity.status(ec.getStatus())
                .body(Result.fail(ec.getCode(),ec.getMessage(),violations));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Result<Void>> handleOther(Exception ex) {
        if (ex instanceof ErrorResponse er) {
            int status = er.getStatusCode().value();
            String detail = er.getBody().getDetail();
            return ResponseEntity.status(status)
                    .body(Result.fail(status * 100, detail != null ? detail : "請求錯誤"));
        }
        log.error("未預期的錯誤", ex);
        ErrorCode ec = ErrorCode.INTERNAL_ERROR;
        return ResponseEntity.status(ec.getStatus())
                .body(Result.fail(ec.getCode(), ec.getMessage()));
    }

    private static String toRule(String constraint) {
        return Character.toLowerCase(constraint.charAt(0)) + constraint.substring(1);
    }
}
