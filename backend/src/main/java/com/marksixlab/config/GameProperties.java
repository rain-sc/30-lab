package com.marksixlab.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.time.Duration;

@Validated
@ConfigurationProperties(prefix = "app.game")
public record GameProperties(
        Duration drawInterval,
        Duration bettingCutoff,
        long pointsPerBet,
        // 號碼範圍 1 ~ maxNumber；至少要 7 個（6 個正碼 + 1 個特別號碼）
        @Min(7) @Max(99) int maxNumber) {
}
