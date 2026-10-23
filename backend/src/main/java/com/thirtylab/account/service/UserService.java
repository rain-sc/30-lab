package com.thirtylab.account.service;

import com.thirtylab.account.model.User;
import com.thirtylab.account.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;

    public Map<String, String> nicknames(Collection<String> userIds){
        return userRepository.findAllById(userIds).stream()
                .collect(Collectors.toMap(User::getId, User::getNickname));
    }
}
