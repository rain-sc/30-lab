package com.thirtylab.common;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import io.swagger.v3.oas.annotations.media.Schema;

public record Result<T>(
        @Schema(description = "0 表示成功，失敗時是 5 位數錯誤碼", requiredMode = REQUIRED)
        int code,

        @Schema(description = "給開發看的說明，不直接顯示給使用者", requiredMode = REQUIRED)
        String msg,

        @Schema(description = "回應資料；沒有資料時是 null", requiredMode = REQUIRED)
        T data) {

    public static <T> Result<T> ok(T data) {
        return new Result<>(0, "ok", data);
    }

    public static <T> Result<T> ok() {
        return ok(null);
    }

    public static <T> Result<T> fail(int code, String msg) {
        return new Result<>(code, msg, null);
    }

    public static <T> Result<T> fail(int code, String msg, T data) {
        return new Result<>(code, msg, data);
    }
}
