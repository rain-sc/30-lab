package com.marksixlab.betting.controller;

import com.marksixlab.betting.dto.PlaceBetRequest;
import com.marksixlab.betting.dto.PlaceBetResponse;
import com.marksixlab.betting.service.BettingService;
import com.marksixlab.common.Result;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

@RestController
@RequestMapping("/api/tickets")
@RequiredArgsConstructor
@Tag(name = "Ticket", description = "下注、我的注單")
public class TicketController {

    private final BettingService bettingService;

    @PostMapping
    @Operation(summary = "下注（同一個 idempotencyKey 重送會回傳同一張注單，不會重複扣款）")
    public Result<PlaceBetResponse> place(@AuthenticationPrincipal String userId,
                                          @Valid @RequestBody PlaceBetRequest req){
        return Result.ok(bettingService.place(userId,req, Instant.now().truncatedTo(ChronoUnit.MILLIS)));
    }
}
