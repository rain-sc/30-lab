package com.marksixlab.account.controller;


import com.marksixlab.account.dto.RegisterRequest;
import com.marksixlab.account.dto.UserResponse;
import com.marksixlab.account.service.AuthService;
import com.marksixlab.common.Result;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
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


    @PostMapping("/register")
    @Operation(summary = "註冊")
    public Result<UserResponse> register(@Valid @RequestBody RegisterRequest req){
        return Result.ok(authService.register(req));
    }
}
