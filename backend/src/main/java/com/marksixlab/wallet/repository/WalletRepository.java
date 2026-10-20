package com.marksixlab.wallet.repository;

import java.util.Optional;

import com.marksixlab.wallet.model.Wallet;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface WalletRepository extends MongoRepository<Wallet, String> {

    Optional<Wallet> findByUserId(String userId);
}
