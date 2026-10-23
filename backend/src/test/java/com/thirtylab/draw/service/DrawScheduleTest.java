package com.thirtylab.draw.service;

import com.thirtylab.config.GameProperties;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class DrawScheduleTest {

    private final DrawSchedule schedule =
            new DrawSchedule(new GameProperties(Duration.ofMinutes(5), Duration.ofSeconds(15), 10,49));

    @Test
    void firstSlotOfTheDay() {
        DrawSlot slot = schedule.slotAt(Instant.parse("2026-10-16T00:00:00Z"));

        assertThat(slot.drawNo()).isEqualTo("20261016-0001");
        assertThat(slot.openAt()).isEqualTo(Instant.parse("2026-10-16T00:00:00Z"));
        assertThat(slot.closeAt()).isEqualTo(Instant.parse("2026-10-16T00:04:45Z"));
        assertThat(slot.drawAt()).isEqualTo(Instant.parse("2026-10-16T00:05:00Z"));
    }

    @Test
    void lastMillisecondStaysInSameSlot() {
        DrawSlot slot = schedule.slotAt(Instant.parse("2026-10-16T00:04:59.999Z"));

        assertThat(slot.drawNo()).isEqualTo("20261016-0001");
    }

    @Test
    void drawTimeBelongsToNextSlot() {
        DrawSlot slot = schedule.slotAt(Instant.parse("2026-10-16T00:05:00Z"));

        assertThat(slot.drawNo()).isEqualTo("20261016-0002");
        assertThat(slot.openAt()).isEqualTo(Instant.parse("2026-10-16T00:05:00Z"));
    }

    @Test
    void lastSlotOfTheDayDrawsAtNextMidnight() {
        DrawSlot slot = schedule.slotAt(Instant.parse("2026-10-16T23:57:30Z"));

        assertThat(slot.drawNo()).isEqualTo("20261016-0288");
        assertThat(slot.drawAt()).isEqualTo(Instant.parse("2026-10-17T00:00:00Z"));
    }
}
