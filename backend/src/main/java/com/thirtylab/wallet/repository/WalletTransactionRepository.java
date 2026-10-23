package com.thirtylab.wallet.repository;

import com.thirtylab.wallet.model.WalletTransaction;
import com.thirtylab.wallet.model.WalletTransactionType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface WalletTransactionRepository extends MongoRepository<WalletTransaction, String> {

    List<WalletTransaction> findByUserId(String userId);

    Page<WalletTransaction> findByUserId(String userId, Pageable pageable);

    boolean existsByTypeAndRefId(WalletTransactionType type, String refId);
}
