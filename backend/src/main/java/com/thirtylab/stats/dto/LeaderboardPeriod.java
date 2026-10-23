package com.thirtylab.stats.dto;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.TemporalAdjusters;

public enum LeaderboardPeriod {
    DAY,
    WEEK;

    public LocalDate firstDay(Instant now){
        LocalDate today = LocalDate.ofInstant(now, ZoneOffset.UTC);
        return switch(this){
            case DAY -> today;
            case WEEK -> today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        };
    }

    public int days(){
        return switch(this){
            case DAY -> 1;
            case WEEK -> 7;
        };
    }
}
