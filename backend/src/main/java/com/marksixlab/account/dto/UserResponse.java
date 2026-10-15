package com.marksixlab.account.dto;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import java.time.Instant;

import com.marksixlab.account.model.User;
import io.swagger.v3.oas.annotations.media.Schema;

public record UserResponse(
        @Schema(requiredMode = REQUIRED, example = "6acf47cac63fcceb21f21085")
        String id,

        @Schema(description = "帳號（小寫）", requiredMode = REQUIRED, example = "rain_01")
        String username,

        @Schema(requiredMode = REQUIRED, example = "小雨")
        String nickname,

        @Schema(description = "註冊時間（UTC）", requiredMode = REQUIRED)
        Instant createdAt) {

    public static UserResponse from(User user) {
        return new UserResponse(user.getId(), user.getUsername(), user.getNickname(), user.getCreatedAt());
    }
}
