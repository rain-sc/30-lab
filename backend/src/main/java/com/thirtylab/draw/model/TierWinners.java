package com.thirtylab.draw.model;

import com.thirtylab.betting.model.PrizeTier;
import io.swagger.v3.oas.annotations.media.Schema;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

public record TierWinners(
        @Schema(requiredMode = REQUIRED)
        PrizeTier tier,

        @Schema(description = "這個獎級中了幾注", requiredMode = REQUIRED, example = "2")
        int lines,

        @Schema(description = "每注獎金；頭獎是平分後的金額，沒人中頭獎是 0", requiredMode = REQUIRED, example = "9600")
        long prize) {
}
