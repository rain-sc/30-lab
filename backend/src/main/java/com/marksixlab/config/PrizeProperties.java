package com.marksixlab.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.prize")
public record PrizeProperties(
        long jackpotFloor,
        long jackpotRatePercent,
        long second,
        long third,
        long fourth,
        long fifth,
        long sixth,
        long seventh
) {
}
