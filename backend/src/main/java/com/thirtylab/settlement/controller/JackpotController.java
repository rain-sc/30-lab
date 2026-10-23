package com.thirtylab.settlement.controller;

import com.thirtylab.common.Result;
import com.thirtylab.settlement.dto.JackpotResponse;
import com.thirtylab.settlement.service.SettlementService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

@RestController
@RequestMapping("/api/jackpot")
@RequiredArgsConstructor
@Tag(name = "Jackpot", description = "頭獎彩池")
public class JackpotController {

    private final SettlementService settlementService;

    @GetMapping
    @Operation(summary = "目前這期的頭獎彩池(不用登入)")
    public Result<JackpotResponse> current(){
        return Result.ok(settlementService.currentJackpot(Instant.now().truncatedTo(ChronoUnit.MILLIS)));
    }
}
