package com.marksixlab.betting.model;

import io.swagger.v3.oas.annotations.media.Schema;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

public record LineResult(
        @Schema(description = "中了幾個正碼", requiredMode = REQUIRED, example = "3")
        int matched,

        @Schema(description = "有沒有中特別號碼",requiredMode = REQUIRED)
        boolean specialHit,

        @Schema(description = "獎級 沒中獎是 null")
        PrizeTier tier,

        @Schema(description =  "這一注的獎金", requiredMode = REQUIRED, example = "40")
        long prize
) {

}
