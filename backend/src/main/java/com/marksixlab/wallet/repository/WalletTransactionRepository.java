package com.marksixlab.wallet.repository;

import com.marksixlab.wallet.model.WalletTransaction;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface WalletTransactionRepository extends MongoRepository<WalletTransaction,String> {

    List<WalletTransaction> findByUserId(String userId);
}
