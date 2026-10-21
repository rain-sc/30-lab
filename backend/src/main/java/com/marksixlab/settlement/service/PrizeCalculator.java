package com.marksixlab.settlement.service;

import com.marksixlab.betting.model.LineResult;
import com.marksixlab.betting.model.PrizeTier;
import com.marksixlab.config.PrizeProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
public class PrizeCalculator {

    private final PrizeProperties prizeProperties;

    public LineResult judge(List<Integer> line, List<Integer> numbers, int specialNumber, long jackpotShare){
        int matched = (int) line.stream().filter(numbers::contains).count();
        boolean specialHit = line.contains(specialNumber);
        PrizeTier tier = PrizeTier.of(matched, specialHit);
        return new LineResult(matched,specialHit,tier,prizeOf(tier,jackpotShare));
    }

    public long jackpotPool(long previousRollover, long turnover){
        long contribution = turnover * prizeProperties.jackpotRatePercent() / 100;
        return Math.max(prizeProperties.jackpotFloor(), previousRollover + contribution);
    }

    private long prizeOf(PrizeTier tier, long jackpotShare){
        if(tier == null){
            return 0;
        }
        return switch(tier){
            case FIRST -> jackpotShare;
            case SECOND -> prizeProperties.second();
            case THIRD -> prizeProperties.third();
            case FOURTH -> prizeProperties.fourth();
            case FIFTH -> prizeProperties.fifth();
            case SIXTH -> prizeProperties.sixth();
            case SEVENTH -> prizeProperties.seventh();
        };
    }
}
