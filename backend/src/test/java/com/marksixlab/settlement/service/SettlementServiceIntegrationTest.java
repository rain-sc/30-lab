package com.marksixlab.settlement.service;

import com.marksixlab.betting.dto.PlaceBetRequest;
import com.marksixlab.betting.model.LineResult;
import com.marksixlab.betting.model.PrizeTier;
import com.marksixlab.betting.model.Ticket;
import com.marksixlab.betting.model.TicketStatus;
import com.marksixlab.betting.repository.TicketRepository;
import com.marksixlab.betting.service.BettingService;
import com.marksixlab.draw.model.Draw;
import com.marksixlab.draw.model.DrawStatus;
import com.marksixlab.draw.repository.DrawRepository;
import com.marksixlab.settlement.dto.JackpotResponse;
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

    @SafeVarargs
    private String bet(String userId, List<Integer>... lines) {
        PlaceBetRequest req = new PlaceBetRequest(DRAW_NO, UUID.randomUUID().toString(), List.of(lines));
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
