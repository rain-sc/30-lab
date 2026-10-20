package com.marksixlab.config;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.game")
public record GameProperties(Duration drawInterval, Duration bettingCutoff, long pointsPerBet) {
}
