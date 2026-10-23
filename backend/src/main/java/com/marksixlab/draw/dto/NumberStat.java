package com.marksixlab.draw.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

public record NumberStat(
        @Schema(description = "號碼 1 ~ maxNumber（見 GET /api/game/rules）", requiredMode = REQUIRED, example = "7")
        int number,

        @Schema(description = "統計範圍內開出幾次正碼", requiredMode = REQUIRED, example = "12")
        int count,

        @Schema(description = "統計範圍內開出幾次特別號碼", requiredMode = REQUIRED, example = "2")
        int specialCount,

        @Schema(description = "已經連續幾期沒開出（正碼或特別號碼都算開出）；0 = 最近一期有開出；整段都沒開過 = window",
                requiredMode = REQUIRED, example = "3")
        int missed
) {
}
