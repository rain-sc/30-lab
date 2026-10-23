package com.thirtylab.betting.model;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@Document("tickets")
@CompoundIndex(name = "userId_idempotencyKey", def = "{'userId': 1, 'idempotencyKey': 1}", unique = true)
@CompoundIndex(name = "userId_createdAt", def = "{'userId': 1, 'createdAt': -1}")
@CompoundIndex(name = "drawNo_status", def = "{'drawNo': 1, 'status': 1}")
@CompoundIndex(name = "userId_status_settledAt", def = "{'userId': 1, 'status': 1, 'settledAt': -1}")
public class Ticket {

    @Id
    private String id;

    private String userId;

    private String drawNo;

    private BetType betType;

    private List<List<Integer>> lines;

    private long cost;

    private TicketStatus status;

    private String idempotencyKey;

    private List<LineResult> results;

    private long payout;

    private Instant settledAt;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
