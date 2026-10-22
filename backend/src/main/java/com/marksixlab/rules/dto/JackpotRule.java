package com.marksixlab.rules.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

public record JackpotRule(
        @Schema(description = "頭獎彩池保底", requiredMode = REQUIRED, example = "1000000")
        long floor,

        @Schema(description = "每期投注額注入彩池的百分比", requiredMode = REQUIRED, example = "20")
        long ratePercent) {
}
