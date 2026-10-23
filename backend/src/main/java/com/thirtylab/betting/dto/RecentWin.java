package com.thirtylab.betting.dto;

import com.thirtylab.betting.model.PrizeTier;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

public record RecentWin(
        @Schema(description = "期數號", requiredMode = REQUIRED, example = "20261022-0055")
        String drawNo,

        @Schema(description = "中獎（結算）時間", requiredMode = REQUIRED)
        Instant settledAt,

        @Schema(description = "這張注單的總獎金", requiredMode = REQUIRED, example = "360")
        long payout,

        @Schema(description = "這張注單裡最高的獎級", requiredMode = REQUIRED)
        PrizeTier bestTier,

        @Schema(description = "這張注單中了幾注", requiredMode = REQUIRED, example = "2")
        int winningLines) {
}
