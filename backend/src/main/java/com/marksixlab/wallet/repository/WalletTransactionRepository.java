package com.marksixlab.wallet.repository;

import com.marksixlab.wallet.model.WalletTransaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface WalletTransactionRepository extends MongoRepository<WalletTransaction,String> {

    Page<WalletTransaction> findByUserId(String userId, Pageable pageable);
}
