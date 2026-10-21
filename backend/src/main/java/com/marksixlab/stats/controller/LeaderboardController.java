package com.marksixlab.stats.controller;

import com.marksixlab.common.Result;
import com.marksixlab.stats.dto.LeaderboardPeriod;
import com.marksixlab.stats.dto.LeaderboardResponse;
import com.marksixlab.stats.service.LeaderboardService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

@RestController
@RequestMapping("/api/leaderboard")
@RequiredArgsConstructor
@Tag(name = "Leaderboard", description = "排行榜")
public class LeaderboardController {

    private final LeaderboardService leaderboardService;

    @GetMapping
    @Operation(summary = "中獎排行榜：今日（DAY）或本週（WEEK），UTC 計算（不用登入；有登入會多回傳自己的名次）")
    public Result<LeaderboardResponse> leaderboard(
            @RequestParam(defaultValue = "DAY") LeaderboardPeriod period,
            @AuthenticationPrincipal String userId
    ){
        return Result.ok(leaderboardService.leaderboard(period,userId, Instant.now().truncatedTo(ChronoUnit.MILLIS)));
    }
}
