package com.marksixlab.wallet.controller;

import com.marksixlab.common.PageResult;
import com.marksixlab.common.Result;
import com.marksixlab.wallet.dto.WalletResponse;
import com.marksixlab.wallet.dto.WalletTransactionResponse;
import com.marksixlab.wallet.service.WalletService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/wallet")
@RequiredArgsConstructor
@Tag(name = "Wallet", description = "積分餘額、積分流水")
public class WalletController {

    private final WalletService walletService;

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
}
