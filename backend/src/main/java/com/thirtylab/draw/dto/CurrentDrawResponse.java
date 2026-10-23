package com.thirtylab.draw.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record CurrentDrawResponse(
        @Schema(description = "伺服器時間 (毫秒精度), 前端用來校正時鐘", requiredMode  = REQUIRED)
        Instant serverTime,

        @Schema(description = "目前這一期", requiredMode = REQUIRED)
        DrawResponse current,

        @Schema(description = "最近一期已開獎的 系統剛上線、還沒開過獎時沒有")
        DrawResponse previous
) {
}
