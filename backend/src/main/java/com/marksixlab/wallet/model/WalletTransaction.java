package com.marksixlab.wallet.model;

import java.time.Instant;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

@Getter
@Setter
@NoArgsConstructor
@Document("wallet_transactions")
@CompoundIndex(name = "type_refId", def = "{'type': 1, 'refId': 1}", unique = true)
@CompoundIndex(name = "userId_createdAt", def = "{'userId': 1, 'createdAt': -1}")
public class WalletTransaction {

    @Id
    private String id;

    private String userId;

    private WalletTransactionType type;

    private long amount;

    private long balanceAfter;

    private String refId;

    @CreatedDate
    private Instant createdAt;
}
