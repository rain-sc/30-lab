package com.thirtylab.stats.service;

import com.thirtylab.account.model.User;
import com.thirtylab.account.repository.UserRepository;
import com.thirtylab.betting.dto.RecentWin;
import com.thirtylab.betting.model.*;
import com.thirtylab.stats.dto.BalanceLeaderboardResponse;
import com.thirtylab.stats.dto.LeaderboardEntry;
import com.thirtylab.stats.dto.LeaderboardPeriod;
import com.thirtylab.stats.dto.LeaderboardResponse;
import com.thirtylab.wallet.model.Wallet;
import com.thirtylab.wallet.model.WalletTransaction;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.test.context.ActiveProfiles;

import java.time.Instant;
import java.util.*;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
class LeaderboardServiceIntegrationTest {

    // 2026-10-21 是星期三，本週從 10-19（一）開始
    private static final Instant NOW = Instant.parse("2026-10-21T12:00:00Z");

    @Autowired
    private LeaderboardService leaderboardService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private MongoTemplate mongoTemplate;

    @BeforeEach
    void setUp() {
        mongoTemplate.remove(new Query(), User.class);
        mongoTemplate.remove(new Query(), Wallet.class);
        mongoTemplate.remove(new Query(), WalletTransaction.class);
        mongoTemplate.remove(new Query(), Ticket.class);
    }

    @Test
    void entriesIncludeTheLatestTenWins() {
        user("u-alice", "Alice");
        user("u-bob", "Bob");
        payout("u-alice", 40, NOW);
        payout("u-bob", 40, NOW);
        // Alice 中過 12 次（0001~0011 各一次，0005 多一張四獎），只回傳最新的 10 次；沒中獎和還沒派彩的注單不算
        for (int i = 1; i <= 11; i++) {
            ticket("u-alice", "20261021-%04d".formatted(i), TicketStatus.PAID, Instant.parse("2026-10-21T00:00:00Z").plusSeconds(300L * i),
                    new LineResult(3, false, PrizeTier.SEVENTH, 40));
        }
        ticket("u-alice", "20261021-0005", TicketStatus.PAID, Instant.parse("2026-10-21T00:25:00Z"),
                new LineResult(4, true, PrizeTier.FOURTH, 9_600),
                new LineResult(3, false, PrizeTier.SEVENTH, 40),
                new LineResult(1, false, null, 0));
        ticket("u-alice", "20261021-0012", TicketStatus.LOST, Instant.parse("2026-10-21T01:00:00Z"),
                new LineResult(2, false, null, 0));
        ticket("u-alice", "20261021-0013", TicketStatus.PENDING, null);

        LeaderboardEntry alice = leaderboardService.leaderboard(LeaderboardPeriod.DAY, "u-alice", NOW).mine();

        assertThat(alice.recentWins()).extracting(RecentWin::drawNo).containsExactly(
                "20261021-0011", "20261021-0010", "20261021-0009", "20261021-0008", "20261021-0007",
                "20261021-0006", "20261021-0005", "20261021-0005", "20261021-0004", "20261021-0003");

        assertThat(alice.recentWins()).contains(new RecentWin("20261021-0005", Instant.parse("2026-10-21T00:25:00Z"), 9_640, PrizeTier.FOURTH, 2));
        assertThat(leaderboardService.leaderboard(LeaderboardPeriod.DAY, null, NOW).entries())
                .filteredOn(entry -> entry.nickname().equals("Bob"))
                .singleElement()
                .extracting(LeaderboardEntry::recentWins)
                .isEqualTo(List.of());
    }


    @Test
    void balanceBoardOnlyListsPlayersWhoHaveBet() {
        user("u-alice", "Alice");
        user("u-bob", "Bob");
        user("u-carol", "Carol");
        user("u-dave", "Dave");
        wallet("u-alice", 12_000);
        wallet("u-bob", 9_000);
        wallet("u-carol", 11_000);   // 只領了簽到、沒下注過：不上榜
        wallet("u-dave", 9_000);
        transaction("u-alice", "BET", -10, NOW);
        transaction("u-bob", "BET", -10, NOW);
        transaction("u-dave", "BET", -10, NOW);
        transaction("u-carol", "DAILY_BONUS", 1_000, NOW);

        BalanceLeaderboardResponse board = leaderboardService.balanceLeaderboard("u-dave");

        assertThat(board.entries()).containsExactly(
                new LeaderboardEntry(1, "Alice", 12_000, false),
                new LeaderboardEntry(2, "Bob", 9_000, false),
                new LeaderboardEntry(2, "Dave", 9_000, true));
        assertThat(board.mine()).isEqualTo(new LeaderboardEntry(2, "Dave", 9_000, true));
        assertThat(leaderboardService.balanceLeaderboard("u-carol").mine()).isNull();
        assertThat(leaderboardService.balanceLeaderboard(null).mine()).isNull();
    }


    @Test
    void dailyBoardRanksTodaysPayoutsWithTies() {
        seedSampleData();

        LeaderboardResponse board = leaderboardService.leaderboard(LeaderboardPeriod.DAY, "u-alice", NOW);

        assertThat(board.from()).isEqualTo(Instant.parse("2026-10-21T00:00:00Z"));
        assertThat(board.to()).isEqualTo(Instant.parse("2026-10-22T00:00:00Z"));
        assertThat(board.entries()).containsExactly(
                new LeaderboardEntry(1, "Bob", 320, false),
                new LeaderboardEntry(1, "Carol", 320, false),
                new LeaderboardEntry(3, "Alice", 40, true));
        assertThat(board.mine()).isEqualTo(new LeaderboardEntry(3, "Alice", 40, true));
    }

    @Test
    void weeklyBoardStartsOnMonday() {
        seedSampleData();

        LeaderboardResponse board = leaderboardService.leaderboard(LeaderboardPeriod.WEEK, null, NOW);

        assertThat(board.from()).isEqualTo(Instant.parse("2026-10-19T00:00:00Z"));
        assertThat(board.to()).isEqualTo(Instant.parse("2026-10-26T00:00:00Z"));
        assertThat(board.entries()).containsExactly(
                new LeaderboardEntry(1, "Alice", 9_640, false),
                new LeaderboardEntry(2, "Bob", 320, false),
                new LeaderboardEntry(2, "Carol", 320, false));
        assertThat(board.mine()).isNull();
    }

    @Test
    void playerWithoutPayoutHasNoRank() {
        seedSampleData();

        assertThat(leaderboardService.leaderboard(LeaderboardPeriod.DAY, "u-erin", NOW).mine()).isNull();
    }

    @Test
    void onlyTopTwentyAreListedButMyRankIsStillReturned() {
        IntStream.rangeClosed(1, 25).forEach(i -> {
            String userId = "u%02d".formatted(i);
            user(userId, "P" + i);
            payout(userId, 1_000 - i, NOW);
        });

        LeaderboardResponse board = leaderboardService.leaderboard(LeaderboardPeriod.DAY, "u25", NOW);

        assertThat(board.entries()).hasSize(20);
        assertThat(board.entries().get(19).rank()).isEqualTo(20);
        assertThat(board.mine()).isEqualTo(new LeaderboardEntry(25, "P25", 975, true));
    }

    private void seedSampleData() {
        user("u-alice", "Alice");
        user("u-bob", "Bob");
        user("u-carol", "Carol");
        user("u-dave", "Dave");
        user("u-erin", "Erin");

        payout("u-alice", 40, Instant.parse("2026-10-21T00:00:00Z"));      // 今天第一毫秒：算今天
        payout("u-alice", 9_600, Instant.parse("2026-10-19T08:00:00Z"));   // 本週一：只算週榜
        payout("u-bob", 320, NOW);
        payout("u-carol", 320, NOW);
        payout("u-dave", 50_000, Instant.parse("2026-10-18T23:59:59.999Z")); // 上週日：都不算
        payout("u-dave", 640, Instant.parse("2026-10-26T00:00:00Z"));      // 下週一：都不算
        transaction("u-erin", "BET", -10, NOW);                            // 下注不是中獎
    }

    private void user(String id, String nickname) {
        User user = new User();
        user.setId(id);
        user.setUsername(id);
        user.setNickname(nickname);
        userRepository.save(user);
    }

    private void ticket(String userId, String drawNo, TicketStatus status, Instant settledAt, LineResult... results) {
        Ticket ticket = new Ticket();
        ticket.setUserId(userId);
        ticket.setDrawNo(drawNo);
        ticket.setBetType(BetType.SINGLE);
        ticket.setLines(Collections.nCopies(Math.max(results.length, 1), List.of(1, 2, 3, 4, 5, 6)));
        ticket.setCost(10L * Math.max(results.length, 1));
        ticket.setStatus(status);
        ticket.setIdempotencyKey(UUID.randomUUID().toString());
        ticket.setResults(results.length == 0 ? null : List.of(results));
        ticket.setPayout(Arrays.stream(results).mapToLong(LineResult::prize).sum());
        ticket.setSettledAt(settledAt);
        mongoTemplate.insert(ticket);
    }

    private void wallet(String userId, long balance) {
        mongoTemplate.insert(new Document("userId", userId).append("balance", balance), "wallets");
    }

    private void payout(String userId, long amount, Instant at) {
        transaction(userId, "PAYOUT", amount, at);
    }

    // 直接寫入原始文件，才能指定 createdAt（用 Repository 存的話會被自動填成現在時間）
    private void transaction(String userId, String type, long amount, Instant at) {
        Document doc = new Document("userId", userId)
                .append("type", type)
                .append("amount", amount)
                .append("balanceAfter", 0L)
                .append("refId", UUID.randomUUID().toString())
                .append("createdAt", Date.from(at));
        mongoTemplate.insert(doc, "wallet_transactions");
    }
}
