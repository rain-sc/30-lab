package com.marksixlab.account.dto;

import com.marksixlab.account.model.User;

import java.time.Instant;

public record UserResponse(String id, String username, String nickname, Instant createdAt) {

    public static UserResponse from(User user){
        return new UserResponse(user.getId(), user.getUsername(), user.getNickname(), user.getCreatedAt());
    }
}
