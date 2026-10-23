package com.thirtylab.betting.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.stream.IntStream;

import com.thirtylab.betting.dto.PlaceBetRequest;
import com.thirtylab.betting.dto.PlaceBetResponse;
import com.thirtylab.betting.model.BetType;
import com.thirtylab.betting.model.Ticket;
import com.thirtylab.betting.repository.TicketRepository;
import com.thirtylab.common.BusinessException;
import com.thirtylab.common.ErrorCode;
import com.thirtylab.wallet.model.Wallet;
import com.thirtylab.wallet.model.WalletTransaction;
import com.thirtylab.wallet.model.WalletTransactionType;
import com.thirtylab.wallet.repository.WalletTransactionRepository;
import com.thirtylab.wallet.service.WalletService;
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
        assertClosed(() -> bettingService.place("u4", PlaceBetRequest.single("20261020-0036", "k1", List.of(LINE)), NOW));
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

        assertThatThrownBy(() -> bettingService.place("u6", PlaceBetRequest.single(OPEN_DRAW, "k1", lines), NOW))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.TOO_MANY_LINES));
    }

    @Test
    void multipleExpandsIntoAllCombinationsAndChargesEachLine() {
        PlaceBetResponse res = bettingService.place("u7",
                PlaceBetRequest.multiple(OPEN_DRAW, "k1", List.of(30, 1, 18, 7, 25, 12, 3, 44)), NOW);

        // 8 個號碼 → C(8,6) = 28 注 × 10 積分
        assertThat(res.ticket().betType()).isEqualTo(BetType.MULTIPLE);
        assertThat(res.ticket().numbers()).containsExactly(1, 3, 7, 12, 18, 25, 30, 44);
        assertThat(res.ticket().lines()).hasSize(28).doesNotHaveDuplicates()
                .allSatisfy(line -> assertThat(line).hasSize(6).isSorted()
                        .isSubsetOf(1, 3, 7, 12, 18, 25, 30, 44));
        assertThat(res.ticket().lines().getFirst()).containsExactly(1, 3, 7, 12, 18, 25);
        assertThat(res.ticket().cost()).isEqualTo(280);
        assertThat(res.balance()).isEqualTo(10_000 - 280);
        assertThat(transactionRepository.findByUserId("u7"))
                .filteredOn(tx -> tx.getType() == WalletTransactionType.BET)
                .singleElement()
                .satisfies(tx -> assertThat(tx.getAmount()).isEqualTo(-280));
    }

    @Test
    void singleTicketHasNoNumbers() {
        PlaceBetResponse res = bettingService.place("u8", request("k1", LINE), NOW);

        assertThat(res.ticket().betType()).isEqualTo(BetType.SINGLE);
        assertThat(res.ticket().numbers()).isNull();
    }

    @Test
    void missingBetTypeMeansSingle() {
        PlaceBetRequest req = new PlaceBetRequest(OPEN_DRAW, "k1", null, List.of(LINE), null, null, null);

        assertThat(bettingService.place("u9", req, NOW).ticket().betType()).isEqualTo(BetType.SINGLE);
    }

    @Test
    void tooManyMultipleNumbersIsRejected() {
        List<Integer> eleven = IntStream.rangeClosed(1, 11).boxed().toList();

        assertThatThrownBy(() -> bettingService.place("u10", PlaceBetRequest.multiple(OPEN_DRAW, "k1", eleven), NOW))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.TOO_MANY_NUMBERS));
        assertThat(ticketRepository.findAll()).isEmpty();
    }

    @Test
    void maxMultipleNumbersIsAccepted() {
        List<Integer> ten = IntStream.rangeClosed(1, 10).boxed().toList();

        PlaceBetResponse res = bettingService.place("u11", PlaceBetRequest.multiple(OPEN_DRAW, "k1", ten), NOW);

        assertThat(res.ticket().lines()).hasSize(210);
        assertThat(res.balance()).isEqualTo(10_000 - 2_100);
    }

    @Test
    void multipleOnClosedDrawIsRejected() {
        List<Integer> seven = IntStream.rangeClosed(1, 7).boxed().toList();

        assertClosed(() -> bettingService.place("u12",
                PlaceBetRequest.multiple(OPEN_DRAW, "k1", seven), Instant.parse("2026-10-20T03:04:45Z")));
        assertThat(ticketRepository.findAll()).isEmpty();
    }

    @Test
    void bankerExpandsAroundBankersAndChargesEachLine() {
        PlaceBetResponse res = bettingService.place("u13",
                PlaceBetRequest.banker(OPEN_DRAW, "k1", List.of(18, 8), List.of(30, 3, 27, 11, 29, 44, 1)), NOW);

        // 2 膽 7 拖 → C(7,4) = 35 注 × 10 積分
        assertThat(res.ticket().betType()).isEqualTo(BetType.BANKER);
        assertThat(res.ticket().bankers()).containsExactly(8, 18);
        assertThat(res.ticket().legs()).containsExactly(1, 3, 11, 27, 29, 30, 44);
        assertThat(res.ticket().numbers()).isNull();
        assertThat(res.ticket().lines()).hasSize(35).doesNotHaveDuplicates()
                .allSatisfy(line -> assertThat(line).hasSize(6).isSorted().contains(8, 18));
        assertThat(res.ticket().cost()).isEqualTo(350);
        assertThat(res.balance()).isEqualTo(10_000 - 350);
    }

    @Test
    void bankerAtLineLimitIsAccepted() {
        // 2 膽 10 拖 = C(10,4) = 210 注，剛好等於上限
        List<Integer> legs = IntStream.rangeClosed(3, 12).boxed().toList();

        PlaceBetResponse res = bettingService.place("u14", PlaceBetRequest.banker(OPEN_DRAW, "k1", List.of(1, 2), legs), NOW);

        assertThat(res.ticket().lines()).hasSize(210);
        assertThat(res.balance()).isEqualTo(10_000 - 2_100);
    }

    @Test
    void bankerOverLineLimitIsRejected() {
        // 1 膽 10 拖 = C(10,5) = 252 注，超過 210
        List<Integer> legs = IntStream.rangeClosed(2, 11).boxed().toList();

        assertThatThrownBy(() -> bettingService.place("u15", PlaceBetRequest.banker(OPEN_DRAW, "k1", List.of(1), legs), NOW))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.TOO_MANY_LINES));
        assertThat(ticketRepository.findAll()).isEmpty();
    }

    @SafeVarargs
    private static PlaceBetRequest request(String key, List<Integer>... lines) {
        return PlaceBetRequest.single(OPEN_DRAW, key, List.of(lines));
    }

    private static void assertClosed(Runnable call) {
        assertThatThrownBy(call::run)
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.BETTING_CLOSED));
    }
}
