package com.thirtylab.betting.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.thirtylab.betting.model.BetType;
import com.thirtylab.betting.validation.BallNumber;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.*;

import java.util.HashSet;
import java.util.List;
import java.util.stream.Stream;

public record PlaceBetRequest(
        @Schema(description = "要下注的期數, 必須是目前這期", example = "20261020-0110")
        @NotBlank
        String drawNo,

        @Schema(description = "防止重複送出: 每次確認下注產生一個新的UUID,重試時沿用", example = "3f1c2a9e-8b7d-4c1e-9f2a-6d5b4e3c2a10")
        @NotBlank @Size(max = 64)
        String idempotencyKey,

        @Schema(description = "玩法；不填是 SINGLE。SINGLE 填 lines，MULTIPLE 填 numbers", example = "SINGLE")
        BetType betType,

        @Schema(description = "單式：每一注 6 個號碼（1 ~ maxNumber，不重複；maxNumber 見 GET /api/game/rules）", example = "[[3, 11, 18, 27, 29, 30], [1, 2, 3, 4, 5, 6]]")
        List<@NotNull @Size(min = 6, max = 6) List<@NotNull @BallNumber Integer>> lines,

        @Schema(description = "複式：7 ~ maxMultipleNumbers 個不重複的號碼，展開成所有 6 個號碼的組合（maxMultipleNumbers 見 GET /api/game/rules）",
                example = "[3, 8, 11, 18, 27, 29, 30]")
        @Size(min = 7)
        List<@NotNull @BallNumber Integer> numbers) {

    public static PlaceBetRequest single(String drawNo, String idempotencyKey, List<List<Integer>> lines) {
        return new PlaceBetRequest(drawNo, idempotencyKey, BetType.SINGLE, lines, null);
    }

    public static PlaceBetRequest multiple(String drawNo, String idempotencyKey, List<Integer> numbers) {
        return new PlaceBetRequest(drawNo, idempotencyKey, BetType.MULTIPLE, null, numbers);
    }

    // 沒填玩法就是單式（舊的前端、機器人不用改）
    @JsonIgnore
    public BetType type() {
        return betType == null ? BetType.SINGLE : betType;
    }

    // 每種玩法只能填自己的欄位：單式要有 lines、複式要有 numbers，另一個不能填
    @JsonIgnore
    @AssertTrue
    public boolean isSelectionMatchesBetType() {
        return switch (type()) {
            case SINGLE -> lines != null && !lines.isEmpty() && numbers == null;
            case MULTIPLE -> numbers != null && lines == null;
        };
    }

    // 同一注（單式）、同一組選號（複式）裡的號碼不能重複
    @JsonIgnore
    @AssertTrue
    public boolean isNumbersDistinct() {
        Stream<List<Integer>> groups = Stream.concat(
                lines == null ? Stream.empty() : lines.stream(),
                numbers == null ? Stream.empty() : Stream.of(numbers));
        return groups.filter(group -> group != null && !group.contains(null))
                .allMatch(group -> new HashSet<>(group).size() == group.size());
    }
}
