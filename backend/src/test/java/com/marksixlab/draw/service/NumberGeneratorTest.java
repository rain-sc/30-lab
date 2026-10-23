package com.marksixlab.draw.service;

import com.marksixlab.config.GameProperties;
import org.junit.jupiter.api.RepeatedTest;

import java.time.Duration;
import java.util.HashSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class NumberGeneratorTest {

    private static final int MAX_NUMBER = 30;

    private final NumberGenerator generator = new NumberGenerator(
            new GameProperties(Duration.ofMinutes(5), Duration.ofSeconds(15), 10, MAX_NUMBER));

    @RepeatedTest(1000)
    void drawsSevenDistinctNumbersInRange() {
        DrawnNumbers result = generator.draw();

        assertThat(result.numbers()).hasSize(6).allMatch(n -> n >= 1 && n <= MAX_NUMBER);
        assertThat(result.specialNumber()).isBetween(1, MAX_NUMBER);

        Set<Integer> all = new HashSet<>(result.numbers());
        all.add(result.specialNumber());
        assertThat(all).hasSize(7);
    }
}
