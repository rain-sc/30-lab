package com.thirtylab.settlement.service;

import com.thirtylab.betting.dto.PlaceBetRequest;
import com.thirtylab.betting.model.LineResult;
import com.thirtylab.betting.model.PrizeTier;
import com.thirtylab.betting.model.Ticket;
import com.thirtylab.betting.model.TicketStatus;
import com.thirtylab.betting.repository.TicketRepository;
import com.thirtylab.betting.service.BettingService;
import com.thirtylab.draw.model.Draw;
import com.thirtylab.draw.model.DrawStatus;
import com.thirtylab.draw.model.PrizeSummary;
import com.thirtylab.draw.model.TierWinners;
import com.thirtylab.draw.repository.DrawRepository;
import com.thirtylab.settlement.dto.JackpotResponse;
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
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.test.context.ActiveProfiles;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
class SettlementServiceIntegrationTest {

    private static final Instant BET_TIME = Instant.parse("2026-10-20T03:02:00Z");
    private static final Instant SETTLE_TIME = Instant.parse("2026-10-20T03:05:01Z");
    private static final String DRAW_NO = "20261020-0037";
    private static final Instant DRAW_AT = Instant.parse("2026-10-20T03:05:00Z");
    private static final List<Integer> NUMBERS = List.of(4, 1, 6, 2, 5, 3);
    private static final int SPECIAL = 7;
    private static final List<Integer> NO_WIN = List.of(10, 11, 12, 13, 14, 15);
    private static final List<Integer> JACKPOT = List.of(1, 2, 3, 4, 5, 6);

    @Autowired
    private SettlementService settlementService;

    @Autowired
    private BettingService bettingService;

    @Autowired
    private WalletService walletService;

    @Autowired
    private TicketRepository ticketRepository;

    @Autowired
    private DrawRepository drawRepository;

    @Autowired
    private WalletTransactionRepository transactionRepository;

    @Autowired
    private MongoTemplate mongoTemplate;

    @BeforeEach
    void clean() {
        mongoTemplate.remove(new Query(), Ticket.class);
        mongoTemplate.remove(new Query(), Draw.class);
        mongoTemplate.remove(new Query(), Wallet.class);
        mongoTemplate.remove(new Query(), WalletTransaction.class);
    }

    @Test
    void everyTierIsPaidAndDrawIsSettled() {
        String ticketId = bet("u1",
                JACKPOT,
                List.of(1, 2, 3, 4, 5, 7),
                List.of(1, 2, 3, 4, 5, 8),
                List.of(1, 2, 3, 4, 7, 8),
                List.of(1, 2, 3, 4, 8, 9),
                List.of(1, 2, 3, 7, 8, 9),
                List.of(1, 2, 3, 8, 9, 10),
                NO_WIN);
        saveDraw(DRAW_NO, DRAW_AT, DrawStatus.DRAWN, null);

        Draw settled = settlementService.settleNext(SETTLE_TIME).orElseThrow();

        assertThat(settled.getStatus()).isEqualTo(DrawStatus.SETTLED);
        assertThat(settled.getPoolAmount()).isEqualTo(1_000_000);
        assertThat(settled.getJackpotWinners()).isEqualTo(1);
        assertThat(settled.getJackpotRollover()).isZero();

        Ticket ticket = ticketRepository.findById(ticketId).orElseThrow();
        assertThat(ticket.getStatus()).isEqualTo(TicketStatus.PAID);
        assertThat(ticket.getResults()).extracting(LineResult::tier).containsExactly(
                PrizeTier.FIRST, PrizeTier.SECOND, PrizeTier.THIRD, PrizeTier.FOURTH,
                PrizeTier.FIFTH, PrizeTier.SIXTH, PrizeTier.SEVENTH, null);
        assertThat(ticket.getPayout()).isEqualTo(1_560_600);
        assertThat(walletService.balance("u1").balance()).isEqualTo(10_000 - 80 + 1_560_600);
    }

    @Test
    void noJackpotWinnerRollsTheWholePoolOver() {
        saveDraw("20261020-0036", Instant.parse("2026-10-20T03:00:00Z"), DrawStatus.SETTLED, 1_500_000L);
        String ticketId = bet("u2", NO_WIN, NO_WIN, NO_WIN, NO_WIN, NO_WIN);
        saveDraw(DRAW_NO, DRAW_AT, DrawStatus.DRAWN, null);

        Draw settled = settlementService.settleNext(SETTLE_TIME).orElseThrow();

        assertThat(settled.getPoolAmount()).isEqualTo(1_500_010);
        assertThat(settled.getJackpotWinners()).isZero();
        assertThat(settled.getJackpotRollover()).isEqualTo(1_500_010);
        assertThat(ticketRepository.findById(ticketId).orElseThrow().getStatus()).isEqualTo(TicketStatus.LOST);
        assertThat(walletService.balance("u2").balance()).isEqualTo(9_950);
    }

    @Test
    void jackpotIsSplitAndRemainderRollsOver() {
        saveDraw("20261020-0036", Instant.parse("2026-10-20T03:00:00Z"), DrawStatus.SETTLED, 1_000_001L);
        bet("u3", JACKPOT);
        bet("u4", JACKPOT);
        saveDraw(DRAW_NO, DRAW_AT, DrawStatus.DRAWN, null);

        Draw settled = settlementService.settleNext(SETTLE_TIME).orElseThrow();

        assertThat(settled.getPoolAmount()).isEqualTo(1_000_005);
        assertThat(settled.getJackpotWinners()).isEqualTo(2);
        assertThat(settled.getJackpotRollover()).isEqualTo(1);
        assertThat(walletService.balance("u3").balance()).isEqualTo(10_000 - 10 + 500_002);
        assertThat(walletService.balance("u4").balance()).isEqualTo(10_000 - 10 + 500_002);
    }

    @Test
    void rerunAfterCrashDoesNotPayTwice() {
        String ticketId = bet("u5", List.of(1, 2, 3, 8, 9, 10));
        saveDraw(DRAW_NO, DRAW_AT, DrawStatus.DRAWN, null);
        settlementService.settleNext(SETTLE_TIME).orElseThrow();

        Ticket ticket = ticketRepository.findById(ticketId).orElseThrow();
        ticket.setStatus(TicketStatus.WON);
        ticketRepository.save(ticket);
        Draw draw = drawRepository.findByDrawNo(DRAW_NO).orElseThrow();
        draw.setStatus(DrawStatus.DRAWN);
        drawRepository.save(draw);

        settlementService.settleNext(SETTLE_TIME).orElseThrow();

        assertThat(walletService.balance("u5").balance()).isEqualTo(10_000 - 10 + 40);
        assertThat(transactionRepository.findByUserId("u5"))
                .filteredOn(tx -> tx.getType() == WalletTransactionType.PAYOUT)
                .hasSize(1);
        assertThat(ticketRepository.findById(ticketId).orElseThrow().getStatus()).isEqualTo(TicketStatus.PAID);
        assertThat(drawRepository.findByDrawNo(DRAW_NO).orElseThrow().getStatus()).isEqualTo(DrawStatus.SETTLED);
    }

    @Test
    void drawsAreSettledOldestFirst() {
        saveDraw("20261020-0038", Instant.parse("2026-10-20T03:10:00Z"), DrawStatus.DRAWN, null);
        saveDraw(DRAW_NO, DRAW_AT, DrawStatus.DRAWN, null);

        assertThat(settlementService.settleNext(SETTLE_TIME)).get().extracting(Draw::getDrawNo).isEqualTo(DRAW_NO);
        assertThat(settlementService.settleNext(SETTLE_TIME)).get().extracting(Draw::getDrawNo).isEqualTo("20261020-0038");
        assertThat(settlementService.settleNext(SETTLE_TIME)).isEmpty();
    }

    @Test
    void currentJackpotAddsRolloverAndBetsSoFar() {
        saveDraw("20261020-0036", Instant.parse("2026-10-20T03:00:00Z"), DrawStatus.SETTLED, 1_500_000L);
        bet("u6", NO_WIN, NO_WIN);
        bet("u7", NO_WIN, NO_WIN, NO_WIN);

        assertThat(settlementService.currentJackpot(BET_TIME)).isEqualTo(new JackpotResponse(DRAW_NO, 1_500_010));
    }

    @Test
    void settlementStoresPrizeSummary() {
        saveDraw("20261020-0036", Instant.parse("2026-10-20T03:00:00Z"), DrawStatus.SETTLED, 1_000_001L);
        List<Integer> seventh = List.of(1, 2, 3, 8, 9, 10);
        bet("u1", JACKPOT, seventh, NO_WIN);
        bet("u2", JACKPOT, seventh, seventh);
        bet("u3", NO_WIN);
        saveDraw(DRAW_NO, DRAW_AT, DrawStatus.DRAWN, null);

        Draw settled = settlementService.settleNext(SETTLE_TIME).orElseThrow();

        // 彩池 1,000,001 + 7 注 × 10 × 20% = 1,000,015，兩注平分：每注 500,007
        assertThat(settled.getPrizeSummary()).isEqualTo(new PrizeSummary(2, 1_000_014 + 120, List.of(
                new TierWinners(PrizeTier.FIRST, 2, 500_007),
                new TierWinners(PrizeTier.SECOND, 0, 500_000),
                new TierWinners(PrizeTier.THIRD, 0, 50_000),
                new TierWinners(PrizeTier.FOURTH, 0, 9_600),
                new TierWinners(PrizeTier.FIFTH, 0, 640),
                new TierWinners(PrizeTier.SIXTH, 0, 320),
                new TierWinners(PrizeTier.SEVENTH, 3, 40))));
    }

    @Test
    void backfillFillsOldSettledDrawsOnce() {
        bet("u1", JACKPOT, List.of(1, 2, 3, 4, 7, 8));
        bet("u2", List.of(1, 2, 3, 8, 9, 10));
        saveDraw(DRAW_NO, DRAW_AT, DrawStatus.DRAWN, null);
        PrizeSummary expected = settlementService.settleNext(SETTLE_TIME).orElseThrow().getPrizeSummary();
        // 模擬這個功能上線前結算的期數：沒有獎級統計
        mongoTemplate.updateFirst(Query.query(Criteria.where("drawNo").is(DRAW_NO)), new Update().unset("prizeSummary"), Draw.class);

        assertThat(settlementService.backfillPrizeSummaries()).isEqualTo(1);
        assertThat(drawRepository.findByDrawNo(DRAW_NO).orElseThrow().getPrizeSummary()).isEqualTo(expected);
        assertThat(expected.winnerCount()).isEqualTo(2);
        assertThat(expected.totalPayout()).isEqualTo(1_000_000 + 9_600 + 40);
        assertThat(settlementService.backfillPrizeSummaries()).isZero();
    }

    @Test
    void multipleTicketIsJudgedLineByLine() {
        // 7 個號碼包含全部 6 個正碼和特別號碼：展開 7 注 = 1 注頭獎 + 6 注二獎（5 個 + 特別號碼）
        String winner = betMultiple("u6", List.of(7, 6, 5, 4, 3, 2, 1));
        // 7 個號碼只中 3 個正碼：去掉 1、2、3 其中一個的 3 注只剩 2 個（沒中），去掉 8~11 其中一個的 4 注中 3 個（七獎）
        String partial = betMultiple("u7", List.of(1, 2, 3, 8, 9, 10, 11));
        saveDraw(DRAW_NO, DRAW_AT, DrawStatus.DRAWN, null);

        Draw settled = settlementService.settleNext(SETTLE_TIME).orElseThrow();

        assertThat(settled.getJackpotWinners()).isEqualTo(1);
        Ticket full = ticketRepository.findById(winner).orElseThrow();
        assertThat(full.getStatus()).isEqualTo(TicketStatus.PAID);
        assertThat(full.getResults()).extracting(LineResult::tier)
                .containsExactlyInAnyOrder(PrizeTier.FIRST, PrizeTier.SECOND, PrizeTier.SECOND, PrizeTier.SECOND,
                        PrizeTier.SECOND, PrizeTier.SECOND, PrizeTier.SECOND);
        assertThat(full.getPayout()).isEqualTo(1_000_000 + 6 * 500_000);
        assertThat(walletService.balance("u6").balance()).isEqualTo(10_000 - 70 + 4_000_000);

        Ticket some = ticketRepository.findById(partial).orElseThrow();
        assertThat(some.getResults()).extracting(LineResult::tier).filteredOn(java.util.Objects::nonNull)
                .containsExactly(PrizeTier.SEVENTH, PrizeTier.SEVENTH, PrizeTier.SEVENTH, PrizeTier.SEVENTH);
        assertThat(some.getPayout()).isEqualTo(4 * 40);

        assertThat(settled.getPrizeSummary().winnerCount()).isEqualTo(2);
        assertThat(settled.getPrizeSummary().tiers())
                .extracting(TierWinners::lines)
                .containsExactly(1, 6, 0, 0, 0, 0, 4);
    }

    private String betMultiple(String userId, List<Integer> numbers) {
        PlaceBetRequest req = PlaceBetRequest.multiple(DRAW_NO, UUID.randomUUID().toString(), numbers);
        return bettingService.place(userId, req, BET_TIME).ticket().id();
    }

    @SafeVarargs
    private String bet(String userId, List<Integer>... lines) {
        PlaceBetRequest req = PlaceBetRequest.single(DRAW_NO, UUID.randomUUID().toString(), List.of(lines));
        return bettingService.place(userId, req, BET_TIME).ticket().id();
    }

    private void saveDraw(String drawNo, Instant drawAt, DrawStatus status, Long rollover) {
        Draw draw = new Draw();
        draw.setDrawNo(drawNo);
        draw.setStatus(status);
        draw.setOpenAt(drawAt.minusSeconds(300));
        draw.setCloseAt(drawAt.minusSeconds(15));
        draw.setDrawAt(drawAt);
        draw.setNumbers(NUMBERS);
        draw.setSpecialNumber(SPECIAL);
        draw.setJackpotRollover(rollover);
        drawRepository.save(draw);
    }
}
