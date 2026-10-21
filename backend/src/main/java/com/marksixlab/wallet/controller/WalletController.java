package com.marksixlab.wallet.controller;

import com.marksixlab.common.PageResult;
import com.marksixlab.common.Result;
import com.marksixlab.wallet.dto.ClaimDailyBonusResponse;
import com.marksixlab.wallet.dto.DailyBonusResponse;
import com.marksixlab.wallet.dto.WalletResponse;
import com.marksixlab.wallet.dto.WalletTransactionResponse;
import com.marksixlab.wallet.service.DailyBonusService;
import com.marksixlab.wallet.service.WalletService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

@RestController
@RequestMapping("/api/wallet")
@RequiredArgsConstructor
@Tag(name = "Wallet", description = "積分餘額、積分流水")
public class WalletController {

    private final WalletService walletService;
    private final DailyBonusService dailyBonusService;

    @GetMapping
    @Operation(summary = "我的積分餘額")
    public Result<WalletResponse> balance(@AuthenticationPrincipal String userId){
        return Result.ok(walletService.balance(userId));
    }

    @GetMapping("/transactions")
    @Operation(summary = "我的積分流水, 由新到舊")
    public Result<PageResult<WalletTransactionResponse>> transactions(
            @AuthenticationPrincipal String userId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size
    ){
        return Result.ok(walletService.transactions(userId, page, size));
    }

    @GetMapping("/daily-bonus")
    @Operation(summary = "今天簽到了沒、可以領多少、下次重置時間")
    public Result<DailyBonusResponse> dailyBonus(@AuthenticationPrincipal String userId){
        return Result.ok(dailyBonusService.status(userId, Instant.now().truncatedTo(ChronoUnit.MILLIS)));
    }

    @PostMapping("/daily-bonus")
    @Operation(summary = "每日簽到領積分（每個 UTC 日一次；今天已經領過回傳 40904）")
    public Result<ClaimDailyBonusResponse> claimDailyBonus(@AuthenticationPrincipal String userId){
        return Result.ok(dailyBonusService.claim(userId,Instant.now().truncatedTo(ChronoUnit.MILLIS)));
    }
}
