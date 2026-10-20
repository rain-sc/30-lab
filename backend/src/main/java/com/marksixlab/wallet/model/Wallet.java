package com.marksixlab.wallet.model;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.Date;

@Getter
@Setter
@NoArgsConstructor
@Document("wallets")
public class Wallet {

    @Id
    private String id;

    @Indexed(unique = true)
    private String userId;

    private long balance;

    @CreatedDate
    private Date createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
