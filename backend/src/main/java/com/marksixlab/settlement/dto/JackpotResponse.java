package com.marksixlab.settlement.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

public record JackpotResponse(
        @Schema(description = "目前這期的期數號", requiredMode = REQUIRED, example = "20261021-0080")
        String drawNo,

        @Schema(description = "本期頭獎彩池(估計值,隨下注增加;開獎後以結算結果為準)", requiredMode = REQUIRED, example = "1000056")
        long amount
) {
}
