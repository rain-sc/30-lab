package com.thirtylab.account.controller;


import com.thirtylab.account.dto.LoginRequest;
import com.thirtylab.account.dto.RegisterRequest;
import com.thirtylab.account.dto.UserResponse;
import com.thirtylab.account.service.AuthService;
import com.thirtylab.common.Result;
import com.thirtylab.config.AuthProperties;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Tag(name = "Auth", description = "註冊、登入")
public class AuthController {
    private final AuthService authService;
    private final AuthProperties  authProperties;

    @PostMapping("/register")
    @Operation(summary = "註冊（成功後直接登入；這個瀏覽器原本登入的其他帳號會被登出）")
    public ResponseEntity<Result<UserResponse>> register(@Valid @RequestBody RegisterRequest req){
        AuthService.LoginResult result = authService.register(req);
        return withCookie(result.token(),authProperties.tokenTtl()).body(Result.ok(result.user()));
    }

    @PostMapping("/login")
    @Operation(summary = "登入（同一帳號會踢掉之前的登入；這個瀏覽器原本登入的其他帳號會被登出）")
    public ResponseEntity<Result<UserResponse>>login(@Valid @RequestBody LoginRequest req){
        AuthService.LoginResult result = authService.login(req);
        return withCookie(result.token(),authProperties.tokenTtl()).body(Result.ok(result.user()));
    }

    @GetMapping("/me")
    @Operation(summary = "目前登入的使用者")
    public Result<UserResponse> me(@AuthenticationPrincipal String userId){
        return Result.ok(authService.me(userId));
    }

    @PostMapping("/logout")
    @Operation(summary = "登出")
    public ResponseEntity<Result<Void>> logout(@AuthenticationPrincipal String userId){
        if(userId != null){
            authService.logout(userId);
        }
        return withCookie("",Duration.ZERO).body(Result.ok());
    }

    private ResponseEntity.BodyBuilder withCookie(String value, Duration maxAge){
        ResponseCookie cookie = ResponseCookie.from(authProperties.cookieName(),value)
                .httpOnly(true)
                .secure(authProperties.cookieSecure())
                .sameSite("Lax")
                .path("/")
                .maxAge(maxAge)
                .build();
        return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, cookie.toString());
    }
}
