package com.marksixlab.common;

import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public enum ErrorCode {

    // 通用（後兩碼 00 = 該 HTTP 狀態的通用錯誤）
    BAD_REQUEST(40000, "請求錯誤"),
    VALIDATION_FAILED(40001, "欄位格式不符"),
    UNAUTHORIZED(40100, "請先登入"),
    FORBIDDEN(40300, "沒有權限"),
    NOT_FOUND(40400, "資源不存在"),
    INTERNAL_ERROR(50000, "系統繁忙，請稍後再試"),

    // 帳戶
    BAD_CREDENTIALS(40101, "帳號或密碼錯誤"),
    USERNAME_TAKEN(40901, "帳號已被使用");

    private final int code;
    private final String message;

    ErrorCode(int code, String message) {
        this.code = code;
        this.message = message;
    }

    public HttpStatus getStatus() {
        return HttpStatus.valueOf(code / 100);
    }
}
