package com.marksixlab.draw.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.HashSet;
import java.util.Set;

import org.junit.jupiter.api.RepeatedTest;

class NumberGeneratorTest {

    private final NumberGenerator generator = new NumberGenerator();

    @RepeatedTest(1000)
    void drawsSevenDistinctNumbersInRange() {
        DrawnNumbers result = generator.draw();

        assertThat(result.numbers()).hasSize(6).allMatch(n -> n >= 1 && n <= 49);
        assertThat(result.specialNumber()).isBetween(1, 49);

        Set<Integer> all = new HashSet<>(result.numbers());
        all.add(result.specialNumber());
        assertThat(all).hasSize(7);
    }
}
