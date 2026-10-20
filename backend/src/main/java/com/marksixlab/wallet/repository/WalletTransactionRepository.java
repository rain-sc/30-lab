package com.marksixlab.wallet.repository;

import java.util.List;

import com.marksixlab.wallet.model.WalletTransaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface WalletTransactionRepository extends MongoRepository<WalletTransaction, String> {

    List<WalletTransaction> findByUserId(String userId);

    Page<WalletTransaction> findByUserId(String userId, Pageable pageable);
}
