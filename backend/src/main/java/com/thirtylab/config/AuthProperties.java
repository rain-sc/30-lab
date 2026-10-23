package com.thirtylab.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties(prefix = "app.auth")
public record AuthProperties(String jwtSecret, Duration tokenTtl, String cookieName, boolean cookieSecure) {
}
