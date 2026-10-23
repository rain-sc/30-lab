package com.thirtylab.rules.service;

import com.thirtylab.betting.model.PrizeTier;
import com.thirtylab.config.BettingProperties;
import com.thirtylab.config.GameProperties;
import com.thirtylab.config.PrizeProperties;
import com.thirtylab.config.WalletProperties;
import com.thirtylab.rules.dto.GameRulesResponse;
import com.thirtylab.rules.dto.JackpotRule;
import com.thirtylab.rules.dto.PrizeRule;
import com.thirtylab.settlement.service.PrizeCalculator;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;

class GameRulesServiceTest {

    private static final PrizeProperties PRIZES = new PrizeProperties(1_000_000, 20, 500_000, 50_000, 9_600, 640, 320, 40);

    private final GameRulesService service = serviceWithBalls(49);

    private static GameRulesService serviceWithBalls(int maxNumber) {
        return new GameRulesService(
                new GameProperties(Duration.ofMinutes(5), Duration.ofSeconds(15), 10, maxNumber),
                new BettingProperties(50, 10, 210),
                new WalletProperties(10_000, 1_000),
                PRIZES,
                new PrizeCalculator(PRIZES));
    }

    @ParameterizedTest
    @CsvSource({
            "49, 6, 13983816",
            "42, 3, 11480",
            "6,  0, 1",
            "6,  6, 1",
            "1,  1, 1",
            "5,  6, 0"
    })
    void choose(int n, int k, long expected) {
        assertThat(Combinations.choose(n, k)).isEqualTo(expected);
    }

    @ParameterizedTest
    @CsvSource({
            "FIRST,   1",
            "SECOND,  6",
            "THIRD,   252",
            "FOURTH,  630",
            "FIFTH,   12915",
            "SIXTH,   17220",
            "SEVENTH, 229600"
    })
    void winningCombinationsPerTier(PrizeTier tier, long expected) {
        assertThat(service.winningCombinations(tier)).isEqualTo(expected);
    }

    @Test
    void oddsFollowTheConfiguredBallCount() {
        GameRulesResponse rules = serviceWithBalls(30).rules();

        // 30 球：沒開出的號碼剩 23 個
        assertThat(rules.maxNumber()).isEqualTo(30);
        assertThat(rules.totalCombinations()).isEqualTo(593_775);
        assertThat(rules.prizes()).extracting(PrizeRule::winningCombinations)
                .containsExactly(1L, 6L, 138L, 345L, 3_795L, 5_060L, 35_420L);
        assertThat(rules.prizes().stream().mapToLong(PrizeRule::winningCombinations).sum()).isEqualTo(44_765);
    }

    @Test
    void rulesComeFromConfiguration() {
        GameRulesResponse rules = service.rules();

        assertThat(rules.maxNumber()).isEqualTo(49);
        assertThat(rules.pickCount()).isEqualTo(6);
        assertThat(rules.pointsPerBet()).isEqualTo(10);
        assertThat(rules.maxLinesPerTicket()).isEqualTo(50);
        assertThat(rules.maxMultipleNumbers()).isEqualTo(10);
        assertThat(rules.maxBankers()).isEqualTo(5);
        assertThat(rules.maxBankerLines()).isEqualTo(210);
        assertThat(rules.drawIntervalSeconds()).isEqualTo(300);
        assertThat(rules.bettingCutoffSeconds()).isEqualTo(15);
        assertThat(rules.totalCombinations()).isEqualTo(13_983_816);
        assertThat(rules.jackpot()).isEqualTo(new JackpotRule(1_000_000, 20));
        assertThat(rules.signupBonus()).isEqualTo(10_000);
        assertThat(rules.dailyBonus()).isEqualTo(1_000);

        assertThat(rules.prizes()).hasSize(7);
        assertThat(rules.prizes().get(0)).isEqualTo(new PrizeRule(PrizeTier.FIRST, 6, false, null, 1));
        assertThat(rules.prizes().get(3)).isEqualTo(new PrizeRule(PrizeTier.FOURTH, 4, true, 9_600L, 630));
        assertThat(rules.prizes()).extracting(PrizeRule::winningCombinations)
                .containsExactly(1L, 6L, 252L, 630L, 12_915L, 17_220L, 229_600L);
        assertThat(rules.prizes().stream().mapToLong(PrizeRule::winningCombinations).sum()).isEqualTo(260_624);
    }

    @Test
    void tierConditionsMatchHowTicketsAreJudged() {
        for (PrizeTier tier : PrizeTier.values()) {
            assertThat(PrizeTier.of(tier.matched(), tier.specialHit())).isEqualTo(tier);
        }
    }
}
