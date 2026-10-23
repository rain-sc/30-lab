package com.marksixlab.draw.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

public record NumberStatsResponse(
        @Schema(description = "實際統計了最近幾期（已開獎的期數不夠時會比要求的少）", requiredMode = REQUIRED, example = "100")
        int window,

        @Schema(description = "1 ~ maxNumber 每個號碼的統計，依號碼排序，固定 maxNumber 筆", requiredMode = REQUIRED)
        List<NumberStat> numbers
        ) {
}
