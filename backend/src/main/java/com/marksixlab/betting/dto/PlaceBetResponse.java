package com.marksixlab.betting.dto;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import io.swagger.v3.oas.annotations.media.Schema;

public record PlaceBetResponse(
        @Schema(requiredMode = REQUIRED)
        TicketResponse ticket,

        @Schema(description = "下注後的積分餘額", requiredMode = REQUIRED, example = "9980")
        long balance
        ){
}
