package com.marksixlab.settlement.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Arrays;
import java.util.List;

import com.marksixlab.betting.model.LineResult;
import com.marksixlab.betting.model.PrizeTier;
import com.marksixlab.config.PrizeProperties;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class PrizeCalculatorTest {

    private static final List<Integer> NUMBERS = List.of(1, 2, 3, 4, 5, 6);
    private static final int SPECIAL = 7;

    private final PrizeCalculator calculator = new PrizeCalculator(
            new PrizeProperties(1_000_000, 20, 500_000, 50_000, 9_600, 640, 320, 40));

    @ParameterizedTest
    @CsvSource({
            "1 2 3 4 5 6,     6, false, FIRST,   123456",
            "1 2 3 4 5 7,     5, true,  SECOND,  500000",
            "1 2 3 4 5 8,     5, false, THIRD,   50000",
            "1 2 3 4 7 8,     4, true,  FOURTH,  9600",
            "1 2 3 4 8 9,     4, false, FIFTH,   640",
            "1 2 3 7 8 9,     3, true,  SIXTH,   320",
            "1 2 3 8 9 10,    3, false, SEVENTH, 40",
            "1 2 7 8 9 10,    2, true,  ,        0",
            "10 11 12 13 14 15, 0, false, ,      0"
    })
    void judgesEachTier(String line, int matched, boolean specialHit, PrizeTier tier, long prize) {
        LineResult result = calculator.judge(parse(line), NUMBERS, SPECIAL, 123_456);

        assertThat(result).isEqualTo(new LineResult(matched, specialHit, tier, prize));
    }

    @Test
    void jackpotPoolNeverBelowFloor() {
        assertThat(calculator.jackpotPool(0, 100)).isEqualTo(1_000_000);
    }

    @Test
    void jackpotPoolAddsRolloverAndContribution() {
        assertThat(calculator.jackpotPool(1_500_000, 1_000)).isEqualTo(1_500_200);
    }

    private static List<Integer> parse(String line) {
        return Arrays.stream(line.trim().split(" ")).map(Integer::valueOf).toList();
    }
}
