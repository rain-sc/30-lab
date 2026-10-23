package com.thirtylab.account.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.Locale;

public record RegisterRequest(
        @Schema(description = "帳號，4–20 個英數字或底線，不分大小寫", example = "rain_01")
        @NotNull @Pattern(regexp = "^[A-Za-z0-9_]{4,20}$")
        String username,

        @Schema(description = "暱稱, 去掉頭尾空白後 2-16 個字", example = "小雨")
        @NotNull @Size(min = 2, max = 16)
        String nickname,

        @Schema(description = "密碼, 8-64個字元", example = "password123")
        @NotNull @Size(min = 8 , max = 64)
        String password
        ) {

    public RegisterRequest {
        if(username != null){
            username = username.strip().toLowerCase(Locale.ROOT);
        }
        if(nickname != null){
            nickname = nickname.strip();
        }
    }
}
