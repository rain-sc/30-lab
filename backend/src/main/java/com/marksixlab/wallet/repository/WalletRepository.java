package com.marksixlab.wallet.repository;

import com.marksixlab.wallet.model.Wallet;
import com.marksixlab.wallet.model.WalletTransaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface WalletRepository extends MongoRepository<Wallet, String> {

    Optional<Wallet> findByUserId(String userId);

    Page<WalletTransaction> findByUserId(String userId, Pageable pageable);
}
