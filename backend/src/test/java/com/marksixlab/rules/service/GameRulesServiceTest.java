package com.marksixlab.rules.service;

import com.marksixlab.betting.model.PrizeTier;
import com.marksixlab.config.BettingProperties;
import com.marksixlab.config.GameProperties;
import com.marksixlab.config.PrizeProperties;
import com.marksixlab.config.WalletProperties;
import com.marksixlab.rules.dto.GameRulesResponse;
import com.marksixlab.rules.dto.JackpotRule;
import com.marksixlab.rules.dto.PrizeRule;
import com.marksixlab.settlement.service.PrizeCalculator;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;

class GameRulesServiceTest {

    private static final PrizeProperties PRIZES = new PrizeProperties(1_000_000, 20, 500_000, 50_000, 9_600, 640, 320, 40);

    private final GameRulesService service = new GameRulesService(
            new GameProperties(Duration.ofMinutes(5), Duration.ofSeconds(15), 10),
            new BettingProperties(50),
            new WalletProperties(10_000, 1_000),
            PRIZES,
            new PrizeCalculator(PRIZES));

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
        assertThat(GameRulesService.winningCombinations(tier)).isEqualTo(expected);
    }

    @Test
    void rulesComeFromConfiguration() {
        GameRulesResponse rules = service.rules();

        assertThat(rules.maxNumber()).isEqualTo(49);
        assertThat(rules.pickCount()).isEqualTo(6);
        assertThat(rules.pointsPerBet()).isEqualTo(10);
        assertThat(rules.maxLinesPerTicket()).isEqualTo(50);
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
