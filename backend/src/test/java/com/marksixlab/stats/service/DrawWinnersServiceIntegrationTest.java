package com.marksixlab.stats.service;

import com.marksixlab.account.model.User;
import com.marksixlab.account.repository.UserRepository;
import com.marksixlab.betting.model.*;
import com.marksixlab.common.BusinessException;
import com.marksixlab.common.ErrorCode;
import com.marksixlab.draw.model.Draw;
import com.marksixlab.draw.model.DrawStatus;
import com.marksixlab.stats.dto.DrawWinner;
import com.marksixlab.stats.dto.DrawWinnersResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.test.context.ActiveProfiles;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("test")
class DrawWinnersServiceIntegrationTest {

    private static final String DRAW_NO = "20261022-0087";
    private static final LineResult FOURTH = new LineResult(4, true, PrizeTier.FOURTH, 9_600);
    private static final LineResult SEVENTH = new LineResult(3, false, PrizeTier.SEVENTH, 40);
    private static final LineResult MISS = new LineResult(1, false, null, 0);

    @Autowired
    private DrawWinnersService drawWinnersService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private MongoTemplate mongoTemplate;

    @BeforeEach
    void setUp() {
        mongoTemplate.remove(new Query(), User.class);
        mongoTemplate.remove(new Query(), Draw.class);
        mongoTemplate.remove(new Query(), Ticket.class);

        Draw draw = new Draw();
        draw.setDrawNo(DRAW_NO);
        draw.setStatus(DrawStatus.SETTLED);
        draw.setDrawAt(Instant.parse("2026-10-22T07:15:00Z"));
        mongoTemplate.insert(draw);

        user("u-alice", "Alice");
        user("u-bob", "Bob");
        user("u-carol", "Carol");
        user("u-dave", "Dave");
    }

    @Test
    void winnersAreGroupedPerPlayerAndSortedByPayout() {
        // Alice 兩張注單都有中：9,600 + 40 + 40 = 9,680，最高四獎，共 3 注
        ticket("u-alice", DRAW_NO, TicketStatus.PAID, FOURTH, SEVENTH, MISS);
        ticket("u-alice", DRAW_NO, TicketStatus.PAID, SEVENTH);
        ticket("u-dave", DRAW_NO, TicketStatus.PAID, SEVENTH);
        ticket("u-bob", DRAW_NO, TicketStatus.PAID, SEVENTH);
        ticket("u-carol", DRAW_NO, TicketStatus.LOST, MISS);              // 沒中
        ticket("u-alice", "20261022-0088", TicketStatus.PAID, FOURTH);    // 別的期數

        DrawWinnersResponse response = drawWinnersService.winners(DRAW_NO, "u-dave");

        assertThat(response.winnerCount()).isEqualTo(3);
        assertThat(response.winners()).containsExactly(
                new DrawWinner("Alice", 9_680, PrizeTier.FOURTH, 3, false),
                new DrawWinner("Bob", 40, PrizeTier.SEVENTH, 1, false),
                new DrawWinner("Dave", 40, PrizeTier.SEVENTH, 1, true));
    }

    @Test
    void drawWithoutWinnersReturnsEmptyList() {
        ticket("u-carol", DRAW_NO, TicketStatus.LOST, MISS);

        DrawWinnersResponse response = drawWinnersService.winners(DRAW_NO, null);

        assertThat(response.winnerCount()).isZero();
        assertThat(response.winners()).isEmpty();
    }

    @Test
    void unknownDrawIsNotFound() {
        assertThatThrownBy(() -> drawWinnersService.winners("20991231-0001", null))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
    }

    private void user(String id, String nickname) {
        User user = new User();
        user.setId(id);
        user.setUsername(id);
        user.setNickname(nickname);
        userRepository.save(user);
    }

    private void ticket(String userId, String drawNo, TicketStatus status, LineResult... results) {
        Ticket ticket = new Ticket();
        ticket.setUserId(userId);
        ticket.setDrawNo(drawNo);
        ticket.setBetType(BetType.SINGLE);
        ticket.setLines(Arrays.stream(results).map(r -> List.of(1, 2, 3, 4, 5, 6)).toList());
        ticket.setCost(10L * results.length);
        ticket.setStatus(status);
        ticket.setIdempotencyKey(UUID.randomUUID().toString());
        ticket.setResults(List.of(results));
        ticket.setPayout(Arrays.stream(results).mapToLong(LineResult::prize).sum());
        ticket.setSettledAt(Instant.parse("2026-10-22T07:15:01Z"));
        mongoTemplate.insert(ticket);
    }
}
