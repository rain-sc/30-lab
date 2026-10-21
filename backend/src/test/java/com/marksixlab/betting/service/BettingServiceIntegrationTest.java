package com.marksixlab.betting.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.stream.IntStream;

import com.marksixlab.betting.dto.PlaceBetRequest;
import com.marksixlab.betting.dto.PlaceBetResponse;
import com.marksixlab.betting.model.Ticket;
import com.marksixlab.betting.repository.TicketRepository;
import com.marksixlab.common.BusinessException;
import com.marksixlab.common.ErrorCode;
import com.marksixlab.wallet.model.Wallet;
import com.marksixlab.wallet.model.WalletTransaction;
import com.marksixlab.wallet.model.WalletTransactionType;
import com.marksixlab.wallet.repository.WalletTransactionRepository;
import com.marksixlab.wallet.service.WalletService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
class BettingServiceIntegrationTest {

    private static final Instant NOW = Instant.parse("2026-10-20T03:02:00Z");
    private static final String OPEN_DRAW = "20261020-0037";
    private static final List<Integer> LINE = List.of(45, 3, 27, 11, 34, 18);

    @Autowired
    private BettingService bettingService;

    @Autowired
    private WalletService walletService;

    @Autowired
    private TicketRepository ticketRepository;

    @Autowired
    private WalletTransactionRepository transactionRepository;

    @Autowired
    private MongoTemplate mongoTemplate;

    @BeforeEach
    void clean() {
        mongoTemplate.remove(new Query(), Ticket.class);
        mongoTemplate.remove(new Query(), Wallet.class);
        mongoTemplate.remove(new Query(), WalletTransaction.class);
    }

    @Test
    void placeBetChargesAndRecordsTicket() {
        PlaceBetResponse res = bettingService.place("u1", request("k1", LINE, LINE), NOW);

        assertThat(res.balance()).isEqualTo(9_980);
        assertThat(res.ticket().cost()).isEqualTo(20);
        assertThat(res.ticket().lines()).containsExactly(List.of(3, 11, 18, 27, 34, 45), List.of(3, 11, 18, 27, 34, 45));
        assertThat(transactionRepository.findByUserId("u1"))
                .anyMatch(tx -> tx.getType() == WalletTransactionType.BET && tx.getRefId().equals(res.ticket().id()));
    }

    @Test
    void sameIdempotencyKeyReturnsSameTicketAndChargesOnce() {
        PlaceBetResponse first = bettingService.place("u2", request("k1", LINE), NOW);
        PlaceBetResponse second = bettingService.place("u2", request("k1", LINE), NOW);

        assertThat(second.ticket().id()).isEqualTo(first.ticket().id());
        assertThat(second.balance()).isEqualTo(9_990);
        assertThat(ticketRepository.findAll()).hasSize(1);
    }

    @Test
    void concurrentResendsWithSameKeyChargeOnce() {
        ExecutorService pool = Executors.newFixedThreadPool(5);
        List<CompletableFuture<Object>> futures = IntStream.range(0, 5)
                .mapToObj(i -> CompletableFuture.supplyAsync(() -> {
                    try {
                        return (Object) bettingService.place("u3", request("k1", LINE), NOW);
                    } catch (RuntimeException e) {
                        return e;
                    }
                }, pool))
                .toList();
        List<Object> results = futures.stream().map(CompletableFuture::join).toList();
        pool.shutdown();

        assertThat(results).allMatch(r -> r instanceof PlaceBetResponse);
        assertThat(results).extracting(r -> ((PlaceBetResponse) r).ticket().id()).containsOnly(((PlaceBetResponse) results.get(0)).ticket().id());
        assertThat(ticketRepository.findAll()).hasSize(1);
        assertThat(walletService.balance("u3").balance()).isEqualTo(9_990);
    }

    @Test
    void wrongDrawIsRejected() {
        assertClosed(() -> bettingService.place("u4", new PlaceBetRequest("20261020-0036", "k1", List.of(LINE)), NOW));
        assertClosed(() -> bettingService.place("u4", request("k2", LINE), Instant.parse("2026-10-20T03:04:45Z")));
        assertThat(ticketRepository.findAll()).isEmpty();
    }

    @Test
    void insufficientPointsCreatesNoTicket() {
        walletService.getOrOpen("u5");
        walletService.debit("u5", 9_990, WalletTransactionType.BET, "setup");

        assertThatThrownBy(() -> bettingService.place("u5", request("k1", LINE, LINE), NOW))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.INSUFFICIENT_POINTS));

        assertThat(ticketRepository.findAll()).isEmpty();
        assertThat(walletService.balance("u5").balance()).isEqualTo(10);
    }

    @Test
    void tooManyLinesIsRejected() {
        List<List<Integer>> lines = Collections.nCopies(51, LINE);

        assertThatThrownBy(() -> bettingService.place("u6", new PlaceBetRequest(OPEN_DRAW, "k1", lines), NOW))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.TOO_MANY_LINES));
    }

    @SafeVarargs
    private static PlaceBetRequest request(String key, List<Integer>... lines) {
        return new PlaceBetRequest(OPEN_DRAW, key, List.of(lines));
    }

    private static void assertClosed(Runnable call) {
        assertThatThrownBy(call::run)
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.BETTING_CLOSED));
    }
}
