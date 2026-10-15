package com.marksixlab.account.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.Locale;

public record LoginRequest(
        @Schema(description = "帳號 (不分大小寫)", example = "rain_01")
        @NotBlank
        String username,

        @Schema(description = "密碼", example = "password123")
        @NotEmpty
        String password
) {

    public LoginRequest{
        if (username != null) {
            username = username.strip().toLowerCase(Locale.ROOT);
        }
    }
}
