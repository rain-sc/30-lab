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
