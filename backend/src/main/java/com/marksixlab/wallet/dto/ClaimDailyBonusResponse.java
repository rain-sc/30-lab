package com.marksixlab.wallet.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

public record ClaimDailyBonusResponse(
        @Schema(description = "這次領到的積分", requiredMode = REQUIRED, example = "1000")
        long amount,

        @Schema(description = "簽到後的積分餘額", requiredMode = REQUIRED, example = "11000")
        long balance,

        @Schema(description = "下次可以簽到的時間(下一個 UTC 00:00)", requiredMode = REQUIRED)
        Instant nextResetAt
) {
}
