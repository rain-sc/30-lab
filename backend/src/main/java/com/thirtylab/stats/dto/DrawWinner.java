package com.thirtylab.stats.dto;

import com.thirtylab.betting.model.PrizeTier;
import io.swagger.v3.oas.annotations.media.Schema;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

public record DrawWinner(
        @Schema(description = "暱稱（可能重複）", requiredMode = REQUIRED, example = "阿正")
        String nickname,

        @Schema(description = "這個人在這期的總獎金（可能是好幾張注單加起來）", requiredMode = REQUIRED, example = "12200")
        long payout,

        @Schema(description = "這個人在這期中到的最高獎級", requiredMode = REQUIRED)
        PrizeTier bestTier,

        @Schema(description = "這個人在這期總共中了幾注", requiredMode = REQUIRED, example = "16")
        int winningLines,

        @Schema(description = "是不是目前登入的自己", requiredMode = REQUIRED)
        boolean me) {
}
