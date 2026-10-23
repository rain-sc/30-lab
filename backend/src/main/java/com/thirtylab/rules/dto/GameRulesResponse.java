package com.thirtylab.rules.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

public record GameRulesResponse(
        @Schema(description = "號碼範圍 1 ~ maxNumber", requiredMode = REQUIRED, example = "30")
        int maxNumber,

        @Schema(description = "每注選幾個號碼", requiredMode = REQUIRED, example = "6")
        int pickCount,

        @Schema(description = "每注幾積分", requiredMode = REQUIRED, example = "10")
        long pointsPerBet,

        @Schema(description = "單式：一張注單最多幾注", requiredMode = REQUIRED, example = "50")
        int maxLinesPerTicket,

        @Schema(description = "複式：最多選幾個號碼（最少是 pickCount + 1；n 個號碼展開成 C(n, pickCount) 注）", requiredMode = REQUIRED, example = "10")
        int maxMultipleNumbers,

        @Schema(description = "幾秒開獎一期", requiredMode = REQUIRED, example = "300")
        long drawIntervalSeconds,

        @Schema(description = "開獎前幾秒停止下注", requiredMode = REQUIRED, example = "15")
        long bettingCutoffSeconds,

        @Schema(description = "一注所有可能的選法 C(maxNumber, pickCount)", requiredMode = REQUIRED, example = "593775")
        long totalCombinations,

        @Schema(description = "獎級，由頭獎到七獎", requiredMode = REQUIRED)
        List<PrizeRule> prizes,

        @Schema(requiredMode = REQUIRED)
        JackpotRule jackpot,

        @Schema(description = "註冊贈送的積分", requiredMode = REQUIRED, example = "10000")
        long signupBonus,

        @Schema(description = "每日簽到贈送的積分", requiredMode = REQUIRED, example = "1000")
        long dailyBonus) {
}
