package com.thirtylab.rules.service;

import com.thirtylab.betting.model.PrizeTier;
import com.thirtylab.config.BettingProperties;
import com.thirtylab.config.GameProperties;
import com.thirtylab.config.PrizeProperties;
import com.thirtylab.config.WalletProperties;
import com.thirtylab.rules.dto.GameRulesResponse;
import com.thirtylab.rules.dto.JackpotRule;
import com.thirtylab.rules.dto.PrizeRule;
import com.thirtylab.settlement.service.PrizeCalculator;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.List;

@Service
@RequiredArgsConstructor
public class GameRulesService {

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
        int maxNumber = gameProperties.maxNumber();
        return new GameRulesResponse(
                maxNumber,
                PICK_COUNT,
                gameProperties.pointsPerBet(),
                bettingProperties.maxLines(),
                bettingProperties.maxMultipleNumbers(),
                PICK_COUNT - 1,
                bettingProperties.maxBankerLines(),
                gameProperties.drawInterval().toSeconds(),
                gameProperties.bettingCutoff().toSeconds(),
                Combinations.choose(maxNumber, PICK_COUNT),
                prizes,
                new JackpotRule(prizeProperties.jackpotFloor(), prizeProperties.jackpotRatePercent()),
                walletProperties.signupBonus(),
                walletProperties.dailyBonus());
    }

    // 一注要中這個獎級：從 6 個正碼選 matched 個 × 特別號碼選或不選 × 其餘從沒開出的號碼選（49 球是 42 個、30 球是 23 個）
    long winningCombinations(PrizeTier tier) {
        int special = tier.specialHit() ? 1 : 0;
        int others = gameProperties.maxNumber() - PICK_COUNT - 1;
        return Combinations.choose(PICK_COUNT, tier.matched())
                * Combinations.choose(1, special)
                * Combinations.choose(others, PICK_COUNT - tier.matched() - special);
    }

}
