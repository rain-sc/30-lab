package com.thirtylab.account.service;

import com.thirtylab.config.AuthProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class SessionService {

    private final StringRedisTemplate redis;
    private final AuthProperties authProperties;

    public record NewSession(String sessionId,String replacedSessionId){}

    public NewSession create(String userId){
        String sessionId = UUID.randomUUID().toString();
        String previous = redis.opsForValue().setGet(key(userId),sessionId,authProperties.tokenTtl());
        return new NewSession(sessionId,previous);
    }

    public String current(String userId){
        return redis.opsForValue().get(key(userId));
    }

    public void remove(String userId){
        redis.delete(key(userId));
    }

    private  static String key(String userId){
        return "session:" + userId;
    }

}
