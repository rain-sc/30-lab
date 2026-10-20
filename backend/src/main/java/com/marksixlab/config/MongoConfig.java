package com.marksixlab.config;


import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.auditing.DateTimeProvider;
import org.springframework.data.mongodb.MongoDatabaseFactory;
import org.springframework.data.mongodb.MongoTransactionManager;
import org.springframework.data.mongodb.config.EnableMongoAuditing;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;

@Configuration
@EnableMongoAuditing(dateTimeProviderRef = "millisDateTimeProvider")
public class MongoConfig {
    @Bean
    public DateTimeProvider millisDateTimeProvider() {
        return () -> Optional.of(Instant.now().truncatedTo((ChronoUnit.MILLIS)));
    }

    @Bean
    public MongoTransactionManager transactionManager(MongoDatabaseFactory factory){
        return new MongoTransactionManager(factory);
    }
}
