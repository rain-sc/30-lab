package com.marksixlab.stats.service;

import com.marksixlab.account.service.UserService;
import com.marksixlab.betting.model.LineResult;
import com.marksixlab.betting.model.PrizeTier;
import com.marksixlab.betting.model.Ticket;
import com.marksixlab.betting.service.BettingService;
import com.marksixlab.common.BusinessException;
import com.marksixlab.common.ErrorCode;
import com.marksixlab.draw.service.DrawService;
import com.marksixlab.stats.dto.DrawWinner;
import com.marksixlab.stats.dto.DrawWinnersResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DrawWinnersService {

    private static final int LIMIT = 50;

    private final DrawService drawService;
    private final BettingService bettingService;
    private final UserService userService;

    // 一個人在這期的中獎加總（可能有好幾張注單）
    private record Winner(String userId, long payout, PrizeTier bestTier, int winningLines) {
    }

    public DrawWinnersResponse winners(String drawNo, String userId) {
        if (!drawService.exists(drawNo)) {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }

        List<Winner> all = bettingService.paidTicketsOfDraw(drawNo).stream()
                .collect(Collectors.groupingBy(Ticket::getUserId))
                .entrySet().stream()
                .map(entry -> toWinner(entry.getKey(), entry.getValue()))
                .sorted(Comparator.comparingLong(Winner::payout).reversed()
                        .thenComparing(Winner::bestTier)
                        .thenComparing(Winner::userId))
                .toList();
        List<Winner> listed = all.stream().limit(LIMIT).toList();

        Map<String, String> nicknames = userService.nicknames(listed.stream().map(Winner::userId).toList());
        List<DrawWinner> winners = listed.stream()
                .map(w -> new DrawWinner(nicknames.get(w.userId()), w.payout(), w.bestTier(), w.winningLines(),
                        w.userId().equals(userId)))
                .toList();
        return new DrawWinnersResponse(drawNo, all.size(), winners);
    }

    private static Winner toWinner(String userId, List<Ticket> tickets) {
        List<PrizeTier> tiers = tickets.stream()
                .flatMap(ticket -> ticket.getResults().stream())
                .map(LineResult::tier)
                .filter(Objects::nonNull)
                .toList();
        long payout = tickets.stream().mapToLong(Ticket::getPayout).sum();
        PrizeTier best = tiers.stream().min(Comparator.naturalOrder()).orElseThrow();
        return new Winner(userId, payout, best, tiers.size());
    }
}
