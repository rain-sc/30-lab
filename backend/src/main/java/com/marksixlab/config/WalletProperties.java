package com.marksixlab.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.wallet")
public record WalletProperties(long signupBonus,long dailyBonus) {
}
