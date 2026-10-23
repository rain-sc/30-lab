package com.thirtylab.stats.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

public record DrawWinnersResponse(
        @Schema(requiredMode = REQUIRED, example = "20261022-0087")
        String drawNo,

        @Schema(description = "這期中獎的總人數（winners 最多只列 50 人）", requiredMode = REQUIRED, example = "25")
        int winnerCount,

        @Schema(description = "中獎名單：獎金由高到低，最多 50 人；還沒結算或沒人中獎是空陣列", requiredMode = REQUIRED)
        List<DrawWinner> winners) {
}
