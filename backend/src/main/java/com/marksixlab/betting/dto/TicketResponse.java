package com.marksixlab.betting.dto;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import com.marksixlab.betting.model.BetType;
import com.marksixlab.betting.model.Ticket;
import com.marksixlab.betting.model.TicketStatus;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.List;

public record TicketResponse(
        @Schema(requiredMode = REQUIRED)
        String id,

        @Schema(requiredMode = REQUIRED, example = "20261020-0110")
        String drawNo,

        @Schema(requiredMode = REQUIRED)
        BetType betType,

        @Schema(description = "每一注的 6 個號碼，由小到大", requiredMode = REQUIRED)
        List<List<Integer>> lines,

        @Schema(description = "花費的積分", requiredMode = REQUIRED, example = "20")
        long cost,

        @Schema(requiredMode = REQUIRED)
        TicketStatus status,

        @Schema(requiredMode = REQUIRED)
        Instant createdAt
        ) {
    public static TicketResponse from(Ticket ticket){
        return new TicketResponse(ticket.getId(),ticket.getDrawNo(),ticket.getBetType(),ticket.getLines(),ticket.getCost(),ticket.getStatus(),ticket.getCreatedAt());
    }
}
