package com.marksixlab.draw.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.marksixlab.draw.model.Draw;
import com.marksixlab.draw.model.DrawStatus;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.List;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record DrawResponse(
        @Schema(description = "期數號 (UTC 日期 + 當天第幾期)", requiredMode = REQUIRED, example = "20261020-0046")
        String drawNo,

        @Schema(requiredMode = REQUIRED)
        DrawStatus status,

        @Schema(description = "開放下注時間", requiredMode = REQUIRED)
        Instant openAt,

        @Schema(description = "停止下注時間（開獎前 15 秒）", requiredMode = REQUIRED)
        Instant closeAt,

        @Schema(description = "開獎時間", requiredMode = REQUIRED)
        Instant drawAt,

        @Schema(description = "6個正碼,依開出順序,不排序;開獎後才有")
        List<Integer>numbers,

        @Schema(description = "特別號碼;開獎後才有")
        Integer specialNumber

) {
    public static DrawResponse from(Draw draw){
        return new DrawResponse(draw.getDrawNo(),draw.getStatus(),draw.getOpenAt(),draw.getCloseAt(),draw.getDrawAt(),draw.getNumbers(),draw.getSpecialNumber());
    }
}
