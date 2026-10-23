package com.thirtylab.wallet.dto;

import org.springframework.data.annotation.Id;

public record UserRank(@Id String userId, long amount, int rank) {
}
