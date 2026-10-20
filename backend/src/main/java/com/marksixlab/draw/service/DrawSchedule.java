package com.marksixlab.draw.service;


import com.marksixlab.config.GameProperties;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;

@Component
public class DrawSchedule {
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("yyyyMMdd").withZone(ZoneOffset.UTC);
    private static final long DAY_MILLIS = Duration.ofDays(1).toMillis();

    private final Duration interval;
    private final Duration cutoff;

    public DrawSchedule(GameProperties props){
        this.interval = props.drawInterval();
        this.cutoff = props.bettingCutoff();
    }

    public DrawSlot slotAt(Instant time){
        long intervalMillis = interval.toMillis();
        long openMillis = Math.floorDiv(time.toEpochMilli(),intervalMillis) * intervalMillis;

        Instant openAt = Instant.ofEpochMilli(openMillis);
        Instant drawAt = openAt.plus(interval);
        Instant closeAt = drawAt.minus(cutoff);

        return new DrawSlot(drawNo(openAt),openAt,closeAt,drawAt);
    }

    private String drawNo(Instant openAt){
        long millisSinceMidnight = openAt.toEpochMilli() % DAY_MILLIS;
        long index = millisSinceMidnight / interval.toMillis() + 1;
        return DATE.format(openAt) + "-" + String.format("%04d",index);
    }
}
