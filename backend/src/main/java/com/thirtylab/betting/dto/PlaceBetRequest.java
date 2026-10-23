package com.thirtylab.betting.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.thirtylab.betting.validation.BallNumber;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.*;

import java.util.HashSet;
import java.util.List;

public record PlaceBetRequest(
        @Schema(description = "要下注的期數, 必須是目前這期", example = "20261020-0110")
        @NotBlank
        String drawNo,

        @Schema(description = "防止重複送出: 每次確認下注產生一個新的UUID,重試時沿用", example = "3f1c2a9e-8b7d-4c1e-9f2a-6d5b4e3c2a10")
        @NotBlank @Size(max = 64)
        String idempotencyKey,

        @Schema(description = "每一注 6 個號碼（1 ~ maxNumber，不重複；maxNumber 見 GET /api/game/rules）", example = "[[3, 11, 18, 27, 29, 30], [1, 2, 3, 4, 5, 6]]")
        @NotEmpty
        List<@NotNull @Size(min = 6, max = 6) List<@NotNull @BallNumber Integer>> lines){

    @JsonIgnore
    @AssertTrue
    public boolean isNumbersDistinct(){
        if(lines  == null){
            return true;
        }
        return lines.stream().filter(line -> line != null && !line.contains(null))
                .allMatch(line -> new HashSet<>(line).size() == line.size());
    }
}
