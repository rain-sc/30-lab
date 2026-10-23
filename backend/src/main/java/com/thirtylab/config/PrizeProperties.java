package com.thirtylab.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

// 沒設定的 long 會是 0，所以 @Min(1) 也能擋住漏寫的設定
@Validated
@ConfigurationProperties(prefix = "app.prize")
public record PrizeProperties(
        @Min(1) long jackpotFloor,
        @Min(1) @Max(100) long jackpotRatePercent,
        @Min(1) long second,
        @Min(1) long third,
        @Min(1) long fourth,
        @Min(1) long fifth,
        @Min(1) long sixth,
        @Min(1) long seventh
) {
}
