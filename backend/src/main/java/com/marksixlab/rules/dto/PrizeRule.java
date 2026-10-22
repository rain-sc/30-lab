package com.marksixlab.rules.dto;

import com.marksixlab.betting.model.PrizeTier;
import io.swagger.v3.oas.annotations.media.Schema;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

public record PrizeRule(
        @Schema(requiredMode = REQUIRED)
        PrizeTier tier,

        @Schema(description = "要中幾個正碼", requiredMode = REQUIRED, example = "5")
        int matched,

        @Schema(description = "要不要中特別號碼", requiredMode = REQUIRED)
        boolean specialHit,

        @Schema(description = "每注固定獎金；頭獎是彩池平分，所以是 null", example = "500000")
        Long prize,

        @Schema(description = "一注會中這個獎級的組合數；機率 = winningCombinations / totalCombinations",
                requiredMode = REQUIRED, example = "6")
        long winningCombinations) {
}
