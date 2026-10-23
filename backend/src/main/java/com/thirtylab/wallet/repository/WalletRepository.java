package com.thirtylab.wallet.repository;

import java.util.Optional;

import com.thirtylab.wallet.model.Wallet;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface WalletRepository extends MongoRepository<Wallet, String> {

    Optional<Wallet> findByUserId(String userId);
}
