package com.marksixlab.stats.service;

import com.marksixlab.account.model.User;
import com.marksixlab.account.repository.UserRepository;
import com.marksixlab.stats.dto.LeaderboardEntry;
import com.marksixlab.stats.dto.LeaderboardPeriod;
import com.marksixlab.stats.dto.LeaderboardResponse;
import com.marksixlab.wallet.model.WalletTransaction;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.test.context.ActiveProfiles;

import java.time.Instant;
import java.util.Date;
import java.util.UUID;
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
        mongoTemplate.remove(new Query(), WalletTransaction.class);
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
