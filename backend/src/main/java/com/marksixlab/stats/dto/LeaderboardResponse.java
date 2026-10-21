package com.marksixlab.stats.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.List;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

public record LeaderboardResponse(
        @Schema(requiredMode = REQUIRED)
        LeaderboardPeriod period,

        @Schema(description = "統計開始時間(含)", requiredMode = REQUIRED)
        Instant from,

        @Schema(description = "統計結束時間（不含），也是下次重置的時間", requiredMode = REQUIRED)
        Instant to,

        @Schema(description = "前 20 名，期間內沒有中獎的人不會上榜", requiredMode = REQUIRED)
        List<LeaderboardEntry> entries,

        @Schema(description = "自己的名次; 沒登入或期間內還沒中獎是 null")
        LeaderboardEntry mine
        ) {
}
