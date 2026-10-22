package com.marksixlab.rules.service;

import com.marksixlab.betting.model.PrizeTier;
import com.marksixlab.config.BettingProperties;
import com.marksixlab.config.GameProperties;
import com.marksixlab.config.PrizeProperties;
import com.marksixlab.config.WalletProperties;
import com.marksixlab.rules.dto.GameRulesResponse;
import com.marksixlab.rules.dto.JackpotRule;
import com.marksixlab.rules.dto.PrizeRule;
import com.marksixlab.settlement.service.PrizeCalculator;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.List;

@Service
@RequiredArgsConstructor
public class GameRulesService {

    static final int MAX_NUMBER = 49;
    static final int PICK_COUNT = 6;

    private final GameProperties gameProperties;
    private final BettingProperties bettingProperties;
    private final WalletProperties walletProperties;
    private final PrizeProperties prizeProperties;
    private final PrizeCalculator prizeCalculator;

    public GameRulesResponse rules() {
        List<PrizeRule> prizes = Arrays.stream(PrizeTier.values())
                .map(tier -> new PrizeRule(tier, tier.matched(), tier.specialHit(),
                        prizeCalculator.fixedPrize(tier), winningCombinations(tier)))
                .toList();

        return new GameRulesResponse(
                MAX_NUMBER,
                PICK_COUNT,
                gameProperties.pointsPerBet(),
                bettingProperties.maxLines(),
                gameProperties.drawInterval().toSeconds(),
                gameProperties.bettingCutoff().toSeconds(),
                Combinations.choose(MAX_NUMBER, PICK_COUNT),
                prizes,
                new JackpotRule(prizeProperties.jackpotFloor(), prizeProperties.jackpotRatePercent()),
                walletProperties.signupBonus(),
                walletProperties.dailyBonus());
    }

    // 一注要中這個獎級：從 6 個正碼選 matched 個 × 特別號碼選或不選 × 其餘從沒開出的 42 個號碼選
    static long winningCombinations(PrizeTier tier) {
        int special = tier.specialHit() ? 1 : 0;
        int others = MAX_NUMBER - PICK_COUNT - 1;
        return Combinations.choose(PICK_COUNT, tier.matched())
                * Combinations.choose(1, special)
                * Combinations.choose(others, PICK_COUNT - tier.matched() - special);
    }
}
