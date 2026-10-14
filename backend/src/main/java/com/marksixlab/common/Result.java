package com.marksixlab.common;

public record Result<T>(int code, String msg,T data) {
    public static <T> Result<T> ok(T data) {
        return new Result<>(0, "ok", data);
    }

    public static <T> Result<T> ok(){
        return ok(null);
    }

    public static <T> Result<T> fail(int code, String msg){
        return new Result<>(code, msg, null);
    }
}
