package com.thirtylab.betting.controller;

import com.thirtylab.betting.dto.PlaceBetRequest;
import com.thirtylab.betting.dto.PlaceBetResponse;
import com.thirtylab.betting.dto.TicketResponse;
import com.thirtylab.betting.service.BettingService;
import com.thirtylab.common.PageResult;
import com.thirtylab.common.Result;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

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

    @GetMapping
    @Operation(summary = "我的注單，由新到舊")
    public Result<PageResult<TicketResponse>> myTickets(
            @AuthenticationPrincipal String userId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size
    ){
        return Result.ok(bettingService.myTickets(userId,page,size));
    }
}
