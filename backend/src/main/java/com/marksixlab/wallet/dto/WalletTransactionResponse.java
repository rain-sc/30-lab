package com.marksixlab.wallet.dto;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import com.marksixlab.wallet.model.WalletTransaction;
import com.marksixlab.wallet.model.WalletTransactionType;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;

public record WalletTransactionResponse (
        @Schema(requiredMode = REQUIRED)
        WalletTransactionType type,

        @Schema(description = "變動金額，收入為正、支出為負", requiredMode = REQUIRED, example = "-10")
        long amount,

        @Schema(description = "變動後的餘額", requiredMode = REQUIRED, example = "9990")
        long balanceAfter,

        @Schema(description = "關聯的資料：註冊贈送是使用者 id，下注 / 派彩是注單 id", requiredMode = REQUIRED)
        String refId,

        @Schema(requiredMode = REQUIRED)
        Instant createdAt
        ) {

    public static WalletTransactionResponse  from(WalletTransaction tx){
        return new WalletTransactionResponse(tx.getType(),tx.getAmount(),tx.getBalanceAfter(),tx.getRefId(),tx.getCreatedAt());
    }
}
