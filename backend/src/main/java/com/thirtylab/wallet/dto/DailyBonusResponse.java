package com.thirtylab.wallet.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

public record DailyBonusResponse(
        @Schema(description = "今天(UTC)是否已經簽到", requiredMode = REQUIRED )
        boolean claimed,

        @Schema(description = "每次簽到可以領的積分", requiredMode = REQUIRED, example = "1000")
        long amount,

        @Schema(description = "下次可以簽到的時間(下一個UTC 00:00)", requiredMode = REQUIRED)
        Instant nextResetAt
) {
}
