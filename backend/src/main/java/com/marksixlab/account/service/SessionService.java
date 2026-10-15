package com.marksixlab.account.service;

import com.marksixlab.config.AuthProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class SessionService {

    private final StringRedisTemplate redis;
    private final AuthProperties authProperties;

    public String create(String userId){
        String sessionId = UUID.randomUUID().toString();
        redis.opsForValue().set(key(userId),sessionId,authProperties.tokenTtl());
        return sessionId;
    }

    private  static String key(String userId){
        return "session:" + userId;
    }
}
