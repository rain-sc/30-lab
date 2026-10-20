package com.marksixlab.account.service;

import com.marksixlab.account.dto.LoginRequest;
import com.marksixlab.account.dto.RegisterRequest;
import com.marksixlab.account.dto.SessionEvent;
import com.marksixlab.account.dto.UserResponse;
import com.marksixlab.account.model.User;
import com.marksixlab.account.repository.UserRepository;
import com.marksixlab.common.BusinessException;
import com.marksixlab.common.ErrorCode;
import com.marksixlab.wallet.service.WalletService;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final SessionService sessionService;
    private final JwtService jwtService;
    private final SimpMessagingTemplate messagingTemplate;
    private final WalletService walletService;
    public record LoginResult(UserResponse user, String token) {
    }

    public LoginResult register(RegisterRequest req) {
        if (userRepository.existsUserByUsername(req.username())) {
            throw new BusinessException(ErrorCode.USERNAME_TAKEN);
        }

        User user = new User();
        user.setUsername(req.username());
        user.setNickname(req.nickname());
        user.setPasswordHash(passwordEncoder.encode(req.password()));

        User saved;
        try {
            saved = userRepository.save(user);
        } catch (DuplicateKeyException e) {
            throw new BusinessException(ErrorCode.USERNAME_TAKEN);
        }
        walletService.getOrOpen(saved.getId());
        return startSession(saved);
    }

    public LoginResult login(LoginRequest req) {
        User user = userRepository.findUserByUsername(req.username())
                .filter(u -> passwordEncoder.matches(req.password(), u.getPasswordHash()))
                .orElseThrow(() -> new BusinessException(ErrorCode.BAD_CREDENTIALS));
        return startSession(user);
    }

    public UserResponse me(String userId) {
        return userRepository.findById(userId)
                .map(UserResponse::from)
                .orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHORIZED));
    }

    public void logout(String userId) {
        sessionService.remove(userId);
    }

    private LoginResult startSession(User user) {
        SessionService.NewSession session = sessionService.create(user.getId());
        if (session.replacedSessionId() != null) {
            messagingTemplate.convertAndSendToUser(
                    session.replacedSessionId(), "/queue/session", new SessionEvent("SESSION_REPLACED"));
        }
        String token = jwtService.issue(user.getId(), session.sessionId());
        return new LoginResult(UserResponse.from(user), token);
    }
}
