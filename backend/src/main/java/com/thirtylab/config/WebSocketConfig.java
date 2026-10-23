package com.thirtylab.config;

import com.thirtylab.account.security.SessionHandshakeHandler;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Lazy;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final String[] allowedOrigins;
    private final TaskScheduler heartbeatScheduler;

    public WebSocketConfig(
            @Value("${app.cors.allowed-origins}") String[] allowedOrigins,
            @Lazy @Qualifier("messageBrokerTaskScheduler") TaskScheduler heartbeatScheduler) {
        this.allowedOrigins = allowedOrigins;
        this.heartbeatScheduler = heartbeatScheduler;
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setHandshakeHandler(new SessionHandshakeHandler())
                .setAllowedOrigins(allowedOrigins);
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic", "/queue")
                .setHeartbeatValue(new long[] {10_000, 10_000})
                .setTaskScheduler(heartbeatScheduler);
        registry.setApplicationDestinationPrefixes("/app");
        registry.setUserDestinationPrefix("/user");
    }
}