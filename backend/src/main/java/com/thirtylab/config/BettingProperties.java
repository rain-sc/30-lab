package com.thirtylab.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "app.betting")
public record BettingProperties(
        // 單式：一張注單最多幾注
        @Min(1) int maxLines,
        // 複式：最多選幾個號碼（至少 7 個才算複式；10 個展開是 C(10,6) = 210 注）
        @Min(7) @Max(15) int maxMultipleNumbers) {
}
