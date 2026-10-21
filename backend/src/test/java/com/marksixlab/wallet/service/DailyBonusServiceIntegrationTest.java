package com.marksixlab.wallet.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.stream.IntStream;

import com.marksixlab.common.BusinessException;
import com.marksixlab.common.ErrorCode;
import com.marksixlab.wallet.dto.ClaimDailyBonusResponse;
import com.marksixlab.wallet.model.Wallet;
import com.marksixlab.wallet.model.WalletTransaction;
import com.marksixlab.wallet.model.WalletTransactionType;
import com.marksixlab.wallet.repository.WalletTransactionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
class DailyBonusServiceIntegrationTest {

    private static final Instant MORNING = Instant.parse("2026-10-21T00:00:00Z");
    private static final Instant LAST_MILLI = Instant.parse("2026-10-21T23:59:59.999Z");
    private static final Instant NEXT_DAY = Instant.parse("2026-10-22T00:00:00Z");

    @Autowired
    private DailyBonusService dailyBonusService;

    @Autowired
    private WalletService walletService;

    @Autowired
    private WalletTransactionRepository transactionRepository;

    @Autowired
    private MongoTemplate mongoTemplate;

    @BeforeEach
    void clean() {
        mongoTemplate.remove(new Query(), Wallet.class);
        mongoTemplate.remove(new Query(), WalletTransaction.class);
    }

    @Test
    void claimOncePerUtcDay() {
        ClaimDailyBonusResponse first = dailyBonusService.claim("u1", MORNING);

        assertThat(first).isEqualTo(new ClaimDailyBonusResponse(1_000, 11_000, NEXT_DAY));
        assertThat(dailyBonusService.status("u1", LAST_MILLI).claimed()).isTrue();
        assertClaimed(() -> dailyBonusService.claim("u1", LAST_MILLI));

        assertThat(dailyBonusService.status("u1", NEXT_DAY).claimed()).isFalse();
        assertThat(dailyBonusService.claim("u1", NEXT_DAY).balance()).isEqualTo(12_000);
    }

    @Test
    void statusBeforeClaiming() {
        assertThat(dailyBonusService.status("u2", MORNING).claimed()).isFalse();
        assertThat(dailyBonusService.status("u2", MORNING).nextResetAt()).isEqualTo(NEXT_DAY);
    }

    @Test
    void concurrentClaimsPayOnce() {
        ExecutorService pool = Executors.newFixedThreadPool(5);
        List<CompletableFuture<Object>> futures = IntStream.range(0, 5)
                .mapToObj(i -> CompletableFuture.supplyAsync(() -> {
                    try {
                        return (Object) dailyBonusService.claim("u3", MORNING);
                    } catch (RuntimeException e) {
                        return e;
                    }
                }, pool))
                .toList();
        List<Object> results = futures.stream().map(CompletableFuture::join).toList();
        pool.shutdown();

        assertThat(results).filteredOn(r -> r instanceof ClaimDailyBonusResponse).hasSize(1);
        assertThat(results).filteredOn(r -> !(r instanceof ClaimDailyBonusResponse))
                .allMatch(r -> r instanceof BusinessException e && e.getErrorCode() == ErrorCode.DAILY_BONUS_CLAIMED);
        assertThat(walletService.balance("u3").balance()).isEqualTo(11_000);
        assertThat(transactionRepository.findByUserId("u3"))
                .filteredOn(tx -> tx.getType() == WalletTransactionType.DAILY_BONUS)
                .hasSize(1);
    }

    private static void assertClaimed(Runnable call) {
        assertThatThrownBy(call::run)
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.DAILY_BONUS_CLAIMED));
    }
}
