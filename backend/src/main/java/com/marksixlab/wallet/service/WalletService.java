package com.marksixlab.wallet.service;

import com.marksixlab.common.BusinessException;
import com.marksixlab.common.ErrorCode;
import com.marksixlab.common.PageResult;
import com.marksixlab.common.Pagination;
import com.marksixlab.config.WalletProperties;
import com.marksixlab.wallet.dto.PayoutRank;
import com.marksixlab.wallet.dto.WalletResponse;
import com.marksixlab.wallet.dto.WalletTransactionResponse;
import com.marksixlab.wallet.model.Wallet;
import com.marksixlab.wallet.model.WalletTransaction;
import com.marksixlab.wallet.model.WalletTransactionType;
import com.marksixlab.wallet.repository.WalletRepository;
import com.marksixlab.wallet.repository.WalletTransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Service
@RequiredArgsConstructor
public class WalletService {

    private final WalletRepository walletRepository;
    private final WalletTransactionRepository transactionRepository;
    private final MongoTemplate mongoTemplate;
    private final WalletProperties walletProperties;

    public Wallet getOrOpen(String userId){
        return walletRepository.findByUserId(userId).orElseGet(() -> open(userId));
    }

    public WalletResponse balance(String userId){
        return new WalletResponse(getOrOpen(userId).getBalance());
    }

    public PageResult<WalletTransactionResponse> transactions(String userId, int page, int size){
        getOrOpen(userId);
        Pageable pageable = Pagination.of(page, size, Sort.by(Sort.Direction.DESC,"createdAt"));
        return PageResult.of(transactionRepository.findByUserId(userId, pageable).map(WalletTransactionResponse::from));
    }

    public List<PayoutRank> payoutRanking(Instant from, Instant to){
        Aggregation aggregation = Aggregation.newAggregation(
                Aggregation.match(Criteria.where("type").is(WalletTransactionType.PAYOUT)
                        .and("createdAt").gte(from).lt(to)),
                Aggregation.group("userId").sum("amount").as("amount"),
                Aggregation.stage("""
                        { $setWindowFields: { sortBy: { amount: -1 }, output: { rank: { $rank: { } } } } }
                        """),
                Aggregation.stage("""
                        { $sort: { rank: 1, _id: 1 } }
                        """));
                return mongoTemplate.aggregate(aggregation, WalletTransaction.class,PayoutRank.class).getMappedResults();
    }

    // 扣款
    @Transactional
    public long debit(String userId, long amount, WalletTransactionType  type, String refId){
        Wallet wallet = mongoTemplate.findAndModify(
                Query.query(Criteria.where("userId").is(userId).and("balance").gte(amount)),
                new Update().inc("balance",-amount).set("updatedAt",now()),
                FindAndModifyOptions.options().returnNew(true),
                Wallet.class
        );
        if(wallet == null){
            throw new BusinessException(ErrorCode.INSUFFICIENT_POINTS);
        }
        record(userId, type, -amount, wallet.getBalance(), refId);
        return wallet.getBalance();
    }

    // 加款，派彩
    @Transactional
    public long credit(String userId, long amount, WalletTransactionType type, String refId){
        Wallet wallet = mongoTemplate.findAndModify(
                Query.query(Criteria.where("userId").is(userId)),
                new Update().inc("balance",amount).set("updatedAt",now()),
                FindAndModifyOptions.options().returnNew(true),
                Wallet.class
        );
        if(wallet == null){
            throw new BusinessException(ErrorCode.NOT_FOUND,"錢包不存在: " + userId);
        }
        record(userId,type,amount,wallet.getBalance(),refId);
        return wallet.getBalance();
    }

    // 開戶
    private Wallet open(String userId){
        long bonus = walletProperties.signupBonus();
        try{
            record(userId,WalletTransactionType.SIGNUP_BONUS, bonus, bonus, userId);
        }catch (DuplicateKeyException e){

        }

        Instant now = Instant.now();
        return mongoTemplate.findAndModify(
                Query.query(Criteria.where("userId").is(userId)),
                new Update().setOnInsert("balance",bonus).setOnInsert("createdAt",now).setOnInsert("updatedAt",now),
                FindAndModifyOptions.options().upsert(true).returnNew(true),
                Wallet.class
        );
    }

    private void record(String userId, WalletTransactionType type, long amount, long balanceAfter, String refId){
        WalletTransaction tx = new WalletTransaction();
        tx.setUserId(userId);
        tx.setType(type);
        tx.setAmount(amount);
        tx.setBalanceAfter(balanceAfter);
        tx.setRefId(refId);
        transactionRepository.insert(tx);
    }

    private static Instant now(){
        return Instant.now().truncatedTo(ChronoUnit.MILLIS);
    }
}
