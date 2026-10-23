package com.thirtylab.draw.model;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

public record PrizeSummary(
        @Schema(description = "中獎人數（同一個人中好幾注只算一次）", requiredMode = REQUIRED, example = "25")
        int winnerCount,

        @Schema(description = "這期總派彩", requiredMode = REQUIRED, example = "48320")
        long totalPayout,

        @Schema(description = "各獎級，由頭獎到七獎，固定 7 筆", requiredMode = REQUIRED)
        List<TierWinners> tiers) {
}
