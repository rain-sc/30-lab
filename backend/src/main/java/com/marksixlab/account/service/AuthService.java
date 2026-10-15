package com.marksixlab.account.service;

import com.marksixlab.account.dto.LoginRequest;
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
    private final SessionService sessionService;
    private final JwtService jwtService;

    public record LoginResult(UserResponse user, String token) {
    }
    public LoginResult register(RegisterRequest req){
        if(userRepository.existsUserByUsername(req.username())){
            throw new BusinessException(ErrorCode.USERNAME_TAKEN);
        }

        User user = new User();
        user.setUsername(req.username());
        user.setNickname(req.nickname());
        user.setPasswordHash(passwordEncoder.encode(req.password()));
        User saved;

        try {
            saved = userRepository.save(user);
        }catch (DuplicateKeyException e){
            throw new BusinessException(ErrorCode.USERNAME_TAKEN);
        }
        return startSession(saved);
    }

    public LoginResult login(LoginRequest req){
        User user = userRepository.findUserByUsername((req.username()))
                .filter(u -> passwordEncoder.matches(req.password(),u.getPasswordHash()))
                .orElseThrow(() -> new BusinessException(ErrorCode.BAD_CREDENTIALS));
        return startSession(user);
    }

    private LoginResult startSession(User user){
        String sessionId = sessionService.create(user.getId());
        String token = jwtService.issue(user.getId(),sessionId);
        return new LoginResult(UserResponse.from(user),token);
    }
}
