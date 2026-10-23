package com.thirtylab.stats.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

public record BalanceLeaderboardResponse(
        @Schema(description = "前 20 名（amount 是目前積分餘額）；只列出至少下注過一次的人", requiredMode = REQUIRED)
        List<LeaderboardEntry> entries,

        @Schema(description = "自己的名次；沒登入或還沒下注過是 null")
        LeaderboardEntry mine) {
}
