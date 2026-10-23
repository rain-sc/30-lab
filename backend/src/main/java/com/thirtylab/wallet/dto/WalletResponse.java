package com.thirtylab.wallet.dto;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import io.swagger.v3.oas.annotations.media.Schema;

public record WalletResponse(
        @Schema(description = "積分餘額", requiredMode = REQUIRED, example = "10000")
        long balance
) {
}
