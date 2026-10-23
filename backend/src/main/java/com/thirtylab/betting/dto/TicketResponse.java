package com.thirtylab.betting.dto;

import com.thirtylab.betting.model.BetType;
import com.thirtylab.betting.model.LineResult;
import com.thirtylab.betting.model.Ticket;
import com.thirtylab.betting.model.TicketStatus;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.List;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

public record TicketResponse(
        @Schema(requiredMode = REQUIRED)
        String id,

        @Schema(requiredMode = REQUIRED, example = "20261020-0110")
        String drawNo,

        @Schema(requiredMode = REQUIRED)
        BetType betType,

        @Schema(description = "每一注的 6 個號碼，由小到大；複式是展開後的所有組合", requiredMode = REQUIRED)
        List<List<Integer>> lines,

        @Schema(description = "複式的原始選號，由小到大；單式是 null", example = "[3, 8, 11, 18, 27, 29, 30]")
        List<Integer> numbers,

        @Schema(description = "花費的積分", requiredMode = REQUIRED, example = "20")
        long cost,

        @Schema(requiredMode = REQUIRED)
        TicketStatus status,

        @Schema(description = "每一注的判獎結果, 順序跟lines一樣 結算前是 null")
        List<LineResult> results,

        @Schema(description = "這張注單的總獎金；結算前是 0", requiredMode = REQUIRED, example = "80")
        long payout,

        @Schema(description = "結算時間; 結算前是 null")
        Instant settledAt,

        @Schema(requiredMode = REQUIRED)
        Instant createdAt
        ) {
    public static TicketResponse from(Ticket ticket){
        return new TicketResponse(ticket.getId(),ticket.getDrawNo(),ticket.getBetType(),ticket.getLines(),ticket.getNumbers(),ticket.getCost(),ticket.getStatus(),ticket.getResults(),ticket.getPayout(),ticket.getSettledAt(),ticket.getCreatedAt());
    }
}
