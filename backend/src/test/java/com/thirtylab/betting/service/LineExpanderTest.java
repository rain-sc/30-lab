package com.thirtylab.betting.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.stream.IntStream;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.api.Test;

class LineExpanderTest {

    @Test
    void sevenNumbersExpandToSevenLinesInOrder() {
        List<List<Integer>> lines = LineExpander.multiple(List.of(7, 1, 6, 2, 5, 3, 4));

        assertThat(lines).containsExactly(
                List.of(1, 2, 3, 4, 5, 6),
                List.of(1, 2, 3, 4, 5, 7),
                List.of(1, 2, 3, 4, 6, 7),
                List.of(1, 2, 3, 5, 6, 7),
                List.of(1, 2, 4, 5, 6, 7),
                List.of(1, 3, 4, 5, 6, 7),
                List.of(2, 3, 4, 5, 6, 7));
    }

    @Test
    void bankerKeepsBankersInEveryLine() {
        // 2 膽 5 拖：從 5 個拖選 4 個 = 5 注（馬會注數表：2 膽 5 拖 = 5 注）
        List<List<Integer>> lines = LineExpander.banker(List.of(18, 8), List.of(30, 3, 27, 11, 29));

        assertThat(lines).containsExactly(
                List.of(3, 8, 11, 18, 27, 29),
                List.of(3, 8, 11, 18, 27, 30),
                List.of(3, 8, 11, 18, 29, 30),
                List.of(3, 8, 18, 27, 29, 30),
                List.of(8, 11, 18, 27, 29, 30));
    }

    // 數字對照馬會的膽拖注數表
    @ParameterizedTest
    @CsvSource({
            "1, 6,  6",
            "1, 7,  21",
            "1, 9,  126",
            "2, 5,  5",
            "2, 10, 210",
            "3, 4,  4",
            "4, 3,  3",
            "5, 2,  2",
            "5, 25, 25"
    })
    void bankerLineCountMatchesExpansion(int bankerCount, int legCount, int expected) {
        List<Integer> bankers = IntStream.rangeClosed(1, bankerCount).boxed().toList();
        List<Integer> legs = IntStream.rangeClosed(bankerCount + 1, bankerCount + legCount).boxed().toList();

        List<List<Integer>> lines = LineExpander.banker(bankers, legs);

        assertThat(LineExpander.bankerLineCount(bankerCount, legCount)).isEqualTo(expected);
        assertThat(lines).hasSize(expected).doesNotHaveDuplicates()
                .allSatisfy(line -> assertThat(line).hasSize(6).isSorted().containsAll(bankers));
    }

    @Test
    void bankerLineCountDoesNotNeedToExpand() {
        // 1 膽 29 拖：118,755 注，只算數量、不展開
        assertThat(LineExpander.bankerLineCount(1, 29)).isEqualTo(118_755);
    }

    @ParameterizedTest
    @CsvSource({
            "6,  1",
            "7,  7",
            "8,  28",
            "9,  84",
            "10, 210"
    })
    void lineCountIsNChooseSix(int count, int expected) {
        List<Integer> numbers = IntStream.rangeClosed(1, count).boxed().toList();

        List<List<Integer>> lines = LineExpander.multiple(numbers);

        assertThat(lines).hasSize(expected).doesNotHaveDuplicates()
                .allSatisfy(line -> assertThat(line).hasSize(6).isSorted().doesNotHaveDuplicates());
    }
}
