package com.marksixlab.wallet.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.stream.IntStream;

import com.marksixlab.common.BusinessException;
import com.marksixlab.common.ErrorCode;
import com.marksixlab.wallet.model.Wallet;
import com.marksixlab.wallet.model.WalletTransaction;
import com.marksixlab.wallet.model.WalletTransactionType;
import com.marksixlab.wallet.repository.WalletRepository;
import com.marksixlab.wallet.repository.WalletTransactionRepository;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;

@SpringBootTest(properties = "spring.mongodb.uri=mongodb://localhost:27018/marksixlab_test?directConnection=true")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class WalletServiceIntegrationTest {

    @Autowired
    private WalletService walletService;

    @Autowired
    private WalletRepository walletRepository;

    @Autowired
    private WalletTransactionRepository transactionRepository;

    @Autowired
    private MongoTemplate mongoTemplate;

    @BeforeEach
    void clean() {
        mongoTemplate.remove(new Query(), Wallet.class);
        mongoTemplate.remove(new Query(), WalletTransaction.class);
    }

    @AfterAll
    void dropTestDatabase() {
        mongoTemplate.getDb().drop();
    }

    @Test
    void openGivesSignupBonusOnlyOnce() {
        walletService.getOrOpen("u1");
        Wallet wallet = walletService.getOrOpen("u1");

        assertThat(wallet.getBalance()).isEqualTo(10_000);
        List<WalletTransaction> txs = transactionRepository.findByUserId("u1");
        assertThat(txs).hasSize(1);
        assertThat(txs.get(0).getType()).isEqualTo(WalletTransactionType.SIGNUP_BONUS);
        assertThat(txs.get(0).getAmount()).isEqualTo(10_000);
    }

    @Test
    void concurrentOpenCreatesOneWalletAndOneBonus() {
        ExecutorService pool = Executors.newFixedThreadPool(10);
        List<CompletableFuture<Wallet>> futures = IntStream.range(0, 10)
                .mapToObj(i -> CompletableFuture.supplyAsync(() -> walletService.getOrOpen("u2"), pool))
                .toList();
        List<Wallet> wallets = futures.stream().map(CompletableFuture::join).toList();
        pool.shutdown();

        assertThat(wallets).allMatch(w -> w.getBalance() == 10_000);
        assertThat(walletRepository.findAll()).hasSize(1);
        assertThat(transactionRepository.findByUserId("u2")).hasSize(1);
    }

    @Test
    void debitReducesBalanceAndRecordsTransaction() {
        walletService.getOrOpen("u3");

        long balance = walletService.debit("u3", 30, WalletTransactionType.BET, "ticket-1");

        assertThat(balance).isEqualTo(9_970);
        assertThat(transactionRepository.findByUserId("u3"))
                .anyMatch(tx -> tx.getType() == WalletTransactionType.BET && tx.getAmount() == -30 && tx.getBalanceAfter() == 9_970);
    }

    @Test
    void debitMoreThanBalanceIsRejected() {
        walletService.getOrOpen("u4");

        assertThatThrownBy(() -> walletService.debit("u4", 20_000, WalletTransactionType.BET, "ticket-1"))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.INSUFFICIENT_POINTS));

        assertThat(walletService.getOrOpen("u4").getBalance()).isEqualTo(10_000);
        assertThat(transactionRepository.findByUserId("u4")).hasSize(1);
    }

    @Test
    void sameRefIdTwiceRollsBackTheSecondDebit() {
        walletService.getOrOpen("u5");
        walletService.debit("u5", 30, WalletTransactionType.BET, "ticket-1");

        assertThatThrownBy(() -> walletService.debit("u5", 30, WalletTransactionType.BET, "ticket-1"))
                .isInstanceOf(DuplicateKeyException.class);

        assertThat(walletService.getOrOpen("u5").getBalance()).isEqualTo(9_970);
        assertThat(transactionRepository.findByUserId("u5")).hasSize(2);
    }

    @Test
    void creditAddsBalance() {
        walletService.getOrOpen("u6");

        long balance = walletService.credit("u6", 640, WalletTransactionType.PAYOUT, "ticket-1");

        assertThat(balance).isEqualTo(10_640);
    }
}
