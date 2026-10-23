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

    // 每一注的 6 個號碼；複式也是展開後一注一注存，判獎、派彩跟單式完全一樣
    private List<List<Integer>> lines;

    // 複式的原始選號（由小到大）；單式是 null
    private List<Integer> numbers;

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
