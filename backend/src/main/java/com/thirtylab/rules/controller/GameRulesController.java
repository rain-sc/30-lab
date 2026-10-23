package com.thirtylab.rules.controller;

import com.thirtylab.common.Result;
import com.thirtylab.rules.dto.GameRulesResponse;
import com.thirtylab.rules.service.GameRulesService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/game")
@RequiredArgsConstructor
@Tag(name = "Game", description = "遊戲規則")
public class GameRulesController {

    private final GameRulesService gameRulesService;

    @GetMapping("/rules")
    @Operation(summary = "遊戲規則：每注積分、時間、獎級與中獎組合數、頭獎彩池規則（不用登入）")
    public Result<GameRulesResponse> rules() {
        return Result.ok(gameRulesService.rules());
    }
}
