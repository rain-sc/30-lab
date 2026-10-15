package com.marksixlab.account.controller;


import com.marksixlab.account.dto.LoginRequest;
import com.marksixlab.account.dto.RegisterRequest;
import com.marksixlab.account.dto.UserResponse;
import com.marksixlab.account.service.AuthService;
import com.marksixlab.common.Result;
import com.marksixlab.config.AuthProperties;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Tag(name = "Auth", description = "註冊、登入")
public class AuthController {
    private final AuthService authService;
    private final AuthProperties  authProperties;

    @PostMapping("/register")
    @Operation(summary = "註冊 (成功後直接登入)")
    public ResponseEntity<Result<UserResponse>> register(@Valid @RequestBody RegisterRequest req){
        return withSessionCookie(authService.register(req));

    }

    @PostMapping("/login")
    @Operation(summary = "登入 (同一帳號會踢掉之前的登入)")
    public ResponseEntity<Result<UserResponse>>login(@Valid @RequestBody LoginRequest req){
        return withSessionCookie(authService.login(req));
    }

    private ResponseEntity<Result<UserResponse>> withSessionCookie(AuthService.LoginResult result){
        ResponseCookie cookie = ResponseCookie.from(authProperties.cookieName(),result.token())
                .httpOnly(true)
                .secure(authProperties.cookieSecure())
                .sameSite("Lax")
                .path("/")
                .maxAge(authProperties.tokenTtl())
                .build();
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE,cookie.toString())
                .body(Result.ok(result.user()));
    }
}
