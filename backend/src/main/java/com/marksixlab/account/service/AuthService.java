package com.marksixlab.account.service;

import com.marksixlab.account.dto.RegisterRequest;
import com.marksixlab.account.dto.UserResponse;
import com.marksixlab.account.model.User;
import com.marksixlab.account.repository.UserRepository;
import com.marksixlab.common.BusinessException;
import com.marksixlab.common.ErrorCode;
import io.swagger.v3.oas.annotations.servers.Server;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public UserResponse register(RegisterRequest req){
        if(userRepository.existsUserByUsername(req.username())){
            throw new BusinessException(ErrorCode.USERNAME_TAKEN);
        }

        User user = new User();
        user.setUsername(req.username());
        user.setNickname(req.nickname());
        user.setPasswordHash(passwordEncoder.encode(req.password()));
        try {
            return UserResponse.from(userRepository.save(user));
        }catch (DuplicateKeyException e){
            throw new BusinessException(ErrorCode.USERNAME_TAKEN);
        }
    }
}
