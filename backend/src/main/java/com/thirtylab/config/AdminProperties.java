package com.thirtylab.config;


import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.admin")
public record AdminProperties(String bootstrapUsername,String bootstrapPassword) {
}
