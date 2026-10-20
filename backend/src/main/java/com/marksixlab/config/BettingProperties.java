package com.marksixlab.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.betting")
public record BettingProperties(int maxLines) {
}
