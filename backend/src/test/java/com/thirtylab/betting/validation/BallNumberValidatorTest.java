package com.thirtylab.betting.validation;

import com.thirtylab.config.GameProperties;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;

class BallNumberValidatorTest {

    private final BallNumberValidator validator = new BallNumberValidator(
            new GameProperties(Duration.ofMinutes(5), Duration.ofSeconds(15), 10, 30));

    @ParameterizedTest
    @CsvSource({
            "1,  true",
            "30, true",
            "0,  false",
            "31, false",
            "-5, false"
    })
    void numberMustBeWithinConfiguredRange(int value, boolean valid) {
        assertThat(validator.isValid(value, null)).isEqualTo(valid);
    }
}
